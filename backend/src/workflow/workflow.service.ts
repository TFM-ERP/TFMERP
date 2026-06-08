import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Universal Workflow & Approval Engine (doc system/06 §E).
 * One engine, any approvable entity. v1 routes SEQUENTIALLY through ordered nodes;
 * each node names an approver by project PermissionTemplate key and/or global role.
 * Nothing the workflow guards "applies" until the final node approves — callers
 * check `isApproved()` before committing the real-world effect.
 */
@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  // ── Definitions (admin-built templates) ────────────────────────────────────────
  listDefinitions(entityType?: string) {
    const where: any = {};
    if (entityType) where.entityType = entityType as any;
    return this.prisma.workflowDefinition.findMany({
      where, orderBy: { name: 'asc' },
      include: { nodes: { orderBy: { order: 'asc' } } },
    });
  }

  async upsertDefinition(data: any) {
    const { key, name, entityType, description, isActive, nodes } = data || {};
    if (!key || !name || !entityType) throw new BadRequestException('key, name and entityType are required.');
    const def = await this.prisma.workflowDefinition.upsert({
      where: { key },
      update: { name, entityType, description: description || null, isActive: isActive ?? true },
      create: { key, name, entityType, description: description || null, isActive: isActive ?? true },
    });
    if (Array.isArray(nodes)) {
      await this.prisma.workflowNode.deleteMany({ where: { definitionId: def.id } });
      await this.prisma.workflowNode.createMany({
        data: nodes.map((n: any, i: number) => ({
          definitionId: def.id, order: n.order ?? i + 1, name: n.name || `Step ${i + 1}`,
          approverTemplateKey: n.approverTemplateKey || null, approverRole: n.approverRole || null,
          slaHours: n.slaHours ?? null, autoApprove: !!n.autoApprove,
        })),
      });
    }
    return this.prisma.workflowDefinition.findUnique({ where: { id: def.id }, include: { nodes: { orderBy: { order: 'asc' } } } });
  }

  // ── Instances (live runs) ──────────────────────────────────────────────────────
  /** Start a workflow for an entity. Picks the active definition for its type (or by key). */
  async start(data: { entityType: string; entityId: string; projectId?: string; label?: string; definitionKey?: string }, userId?: string) {
    if (!data.entityType || !data.entityId) throw new BadRequestException('entityType and entityId are required.');
    const def = data.definitionKey
      ? await this.prisma.workflowDefinition.findUnique({ where: { key: data.definitionKey }, include: { nodes: { orderBy: { order: 'asc' } } } })
      : await this.prisma.workflowDefinition.findFirst({ where: { entityType: data.entityType as any, isActive: true }, include: { nodes: { orderBy: { order: 'asc' } } } });
    if (!def) throw new BadRequestException(`No active workflow defined for ${data.entityType}.`);
    if (!def.nodes.length) throw new BadRequestException(`Workflow "${def.name}" has no steps.`);
    // one open instance per entity
    const open = await this.prisma.workflowInstance.findFirst({ where: { entityType: data.entityType as any, entityId: data.entityId, status: 'PENDING' } });
    if (open) return this.instance(open.id);

    const inst = await this.prisma.workflowInstance.create({
      data: {
        definitionId: def.id, entityType: data.entityType as any, entityId: data.entityId,
        projectId: data.projectId || null, label: data.label || null, startedById: userId || null, currentOrder: 1,
      },
    });
    await this.autoSkip(inst.id); // advance past any autoApprove nodes
    return this.instance(inst.id);
  }

  /** Full instance with definition, nodes, action history, and the current node. */
  async instance(id: string) {
    const inst = await this.prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        definition: { include: { nodes: { orderBy: { order: 'asc' } } } },
        actions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!inst) throw new NotFoundException('Workflow instance not found');
    const currentNode = inst.definition.nodes.find((n) => n.order === inst.currentOrder) || null;
    return { ...inst, currentNode };
  }

  /** History for a specific entity (e.g. one PO). */
  forEntity(entityType: string, entityId: string) {
    return this.prisma.workflowInstance.findMany({
      where: { entityType: entityType as any, entityId },
      orderBy: { createdAt: 'desc' },
      include: { definition: { select: { name: true } }, actions: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Is this entity's latest workflow fully approved? Callers gate the real effect on this. */
  async isApproved(entityType: string, entityId: string): Promise<boolean> {
    const last = await this.prisma.workflowInstance.findFirst({
      where: { entityType: entityType as any, entityId }, orderBy: { createdAt: 'desc' },
    });
    return last?.status === 'APPROVED';
  }

  // ── Acting on a node ─────────────────────────────────────────────────────────────
  /** Approve / reject the current node. Validates the actor may act, records history, advances. */
  async act(instanceId: string, userId: string | undefined, action: 'APPROVE' | 'REJECT', comment?: string) {
    const inst = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { definition: { include: { nodes: { orderBy: { order: 'asc' } } } } },
    });
    if (!inst) throw new NotFoundException('Workflow instance not found');
    if (inst.status !== 'PENDING') throw new BadRequestException(`This approval is already ${inst.status}.`);
    const node = inst.definition.nodes.find((n) => n.order === inst.currentOrder);
    if (!node) throw new BadRequestException('No current step to act on.');

    const ok = await this.userCanActOnNode(node, inst.projectId, userId);
    if (!ok) throw new ForbiddenException(`You are not an approver for step "${node.name}".`);

    // Segregation of duties: the person who submitted an item cannot approve it,
    // and no one may approve the same item twice (one approver per step).
    if (action === 'APPROVE') {
      if (userId && inst.startedById && userId === inst.startedById) {
        throw new ForbiddenException('Segregation of duties: you submitted this item, so you cannot approve it.');
      }
      const already = await this.prisma.approvalAction.findFirst({ where: { instanceId, actorId: userId || undefined, action: 'APPROVED' } });
      if (already) throw new ForbiddenException('You have already approved a step on this item; another approver must take the next step.');
    }

    if (action === 'REJECT') {
      await this.prisma.approvalAction.create({ data: { instanceId, nodeOrder: node.order, action: 'REJECTED', actorId: userId || null, comment: comment || null } });
      await this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { status: 'REJECTED', closedAt: new Date() } });
      await this.applyCompletionEffect(inst.entityType, inst.entityId, 'REJECTED', userId);
      return this.instance(instanceId);
    }

    await this.prisma.approvalAction.create({ data: { instanceId, nodeOrder: node.order, action: 'APPROVED', actorId: userId || null, comment: comment || null } });
    const next = inst.definition.nodes.find((n) => n.order > inst.currentOrder);
    if (!next) {
      await this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { status: 'APPROVED', closedAt: new Date() } });
      await this.applyCompletionEffect(inst.entityType, inst.entityId, 'APPROVED', userId);
    } else {
      await this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { currentOrder: next.order } });
      await this.autoSkip(instanceId);
    }
    return this.instance(instanceId);
  }

  /**
   * Apply the real-world effect when a workflow finishes — decoupled: the engine
   * only flips the entity's own status via Prisma (no domain-service imports, no
   * circular deps). Each entity keeps its existing status field as the source of
   * truth; the workflow simply drives it. Unknown types are a safe no-op.
   */
  private async applyCompletionEffect(entityType: string, entityId: string, outcome: 'APPROVED' | 'REJECTED', userId?: string) {
    try {
      if (entityType === 'PURCHASE_ORDER') {
        await this.prisma.purchaseOrder.update({ where: { id: entityId }, data: { status: outcome === 'APPROVED' ? 'APPROVED' : 'REJECTED' } as any });
      } else if (entityType === 'BUDGET_TRANSFER') {
        await this.prisma.budgetTransfer.update({ where: { id: entityId }, data: { status: outcome as any, approvedById: outcome === 'APPROVED' ? (userId || null) : null, approvedAt: new Date() } });
      } else if (entityType === 'OVERAGE') {
        await this.prisma.overage.update({ where: { id: entityId }, data: { status: outcome as any } as any });
      } else if (entityType === 'TIMECARD') {
        if (outcome === 'APPROVED') await this.prisma.timecard.update({ where: { id: entityId }, data: { status: 'APPROVED' } as any });
      } else if (entityType === 'INVOICE' || entityType === 'EXPENSE') {
        // Project-side AP: a ProjectTransaction COST. Approve = it counts as an actual.
        await this.prisma.projectTransaction.update({
          where: { id: entityId },
          data: { status: outcome === 'APPROVED' ? 'APPROVED' : 'DRAFT', approvedById: outcome === 'APPROVED' ? (userId || null) : null } as any,
        }).catch(() => {});
      } else if (entityType === 'LOCATION') {
        // SYS-07: the entity is a LocationPermit. Internal sign-off → APPROVED / REJECTED.
        await this.prisma.locationPermit.update({
          where: { id: entityId },
          data: { status: outcome === 'APPROVED' ? 'APPROVED' : 'REJECTED' } as any,
        }).catch(() => {});
      }
    } catch { /* entity may have been removed; never break the approval record */ }
  }

  async cancel(instanceId: string, userId?: string, comment?: string) {
    await this.prisma.approvalAction.create({ data: { instanceId, nodeOrder: 0, action: 'CANCELLED', actorId: userId || null, comment: comment || null } });
    return this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { status: 'CANCELLED', closedAt: new Date() } });
  }

  /** My pending approvals — instances whose current node I'm an approver for. */
  async myPending(userId?: string) {
    if (!userId) return [];
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const open = await this.prisma.workflowInstance.findMany({
      where: { status: 'PENDING' },
      include: { definition: { include: { nodes: { orderBy: { order: 'asc' } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const mine: any[] = [];
    for (const inst of open) {
      const node = inst.definition.nodes.find((n) => n.order === inst.currentOrder);
      if (!node) continue;
      if (await this.userCanActOnNode(node, inst.projectId, userId, user?.role)) {
        mine.push({ id: inst.id, entityType: inst.entityType, entityId: inst.entityId, projectId: inst.projectId, label: inst.label, step: node.name, definition: inst.definition.name, createdAt: inst.createdAt });
      }
    }
    return mine;
  }

  // ── helpers ──────────────────────────────────────────────────────────────────────
  private async autoSkip(instanceId: string) {
    // pass any consecutive autoApprove nodes from the current position
    for (let guard = 0; guard < 50; guard++) {
      const inst = await this.prisma.workflowInstance.findUnique({ where: { id: instanceId }, include: { definition: { include: { nodes: { orderBy: { order: 'asc' } } } } } });
      if (!inst || inst.status !== 'PENDING') return;
      const node = inst.definition.nodes.find((n) => n.order === inst.currentOrder);
      if (!node || !node.autoApprove) return;
      await this.prisma.approvalAction.create({ data: { instanceId, nodeOrder: node.order, action: 'AUTO', comment: 'Auto-approved' } });
      const next = inst.definition.nodes.find((n) => n.order > inst.currentOrder);
      if (!next) { await this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { status: 'APPROVED', closedAt: new Date() } }); return; }
      await this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { currentOrder: next.order } });
    }
  }

  /** Can this user act on the node? Matches the node's project-template OR global role. */
  private async userCanActOnNode(node: any, projectId: string | null, userId?: string, globalRole?: string): Promise<boolean> {
    if (!userId) return false;
    // global-role match
    if (node.approverRole) {
      const role = globalRole || (await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role;
      if (role && (role === node.approverRole || role === 'SYSTEM_ADMIN')) return true;
    }
    // project-template match
    if (node.approverTemplateKey && projectId) {
      const a = await this.prisma.projectRoleAssignment.findUnique({
        where: { projectId_userId: { projectId, userId } },
        include: { template: { select: { key: true } } },
      });
      if (a?.template?.key === node.approverTemplateKey) return true;
    }
    // SYSTEM_ADMIN can always act (safety valve)
    const role = globalRole || (await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role;
    return role === 'SYSTEM_ADMIN';
  }
}
