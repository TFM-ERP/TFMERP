# Film Crew Taxonomy — Department → Roles (cascading picker)

**Goal:** when adding crew (Crew Directory and per‑project crew), pick a **Department**, and the **Role/Job** field then offers only the jobs that belong to that department. An "Other…" option always allows a custom title so the list never blocks you.

Sources cross‑checked: StudioBinder, Wrapbook, Backstage, Assemble, Saturation.io film‑crew guides.

---

## Design

- **Data:** a single taxonomy `DEPARTMENTS = [{ department, roles[] }]` held in `frontend/src/lib/filmCrew.ts`. Pure reference data — no schema change (department & role stay strings).
- **UX:** Department = `<select>`. Role = dependent `<select>` populated from the chosen department's roles, with a final **"Other (type…)"** option that reveals a free‑text input. Editing an existing member pre‑selects both.
- **Where:** Crew Directory add/edit form first; optionally the per‑project crew/assignment picker too.
- **Future (optional):** move the taxonomy into an admin‑editable DB table so departments/roles can be managed without code. v1 ships as the constant below.

---

## The taxonomy

### Above‑the‑Line
**Production (Producers)** — Executive Producer · Co‑Executive Producer · Producer · Co‑Producer · Associate Producer · Line Producer · Production Executive
**Direction** — Director · Co‑Director · 2nd Unit Director · Director's Assistant
**Writing** — Writer · Screenwriter · Staff Writer · Story Editor · Script Editor
**Casting** — Casting Director · Casting Associate · Casting Assistant · Extras/Background Casting

### Production / Management
**Production Office** — Unit Production Manager (UPM) · Production Supervisor · Production Coordinator · Assistant Production Coordinator (APOC) · Production Secretary · Office Production Assistant · Travel Coordinator
**Assistant Directors** — 1st Assistant Director · 2nd Assistant Director · 2nd 2nd AD · 3rd Assistant Director · Additional AD · Set PA · Floor Runner
**Script / Continuity** — Script Supervisor
**Accounting** — Production Accountant · 1st Assistant Accountant · 2nd Assistant Accountant · Payroll Accountant · Accounts Clerk · Post‑Production Accountant

### Camera & Lighting
**Camera** — Director of Photography (DP) · Camera Operator · A‑Camera Operator · B‑Camera Operator · Steadicam Operator · 1st AC (Focus Puller) · 2nd AC (Clapper Loader) · Camera Loader · DIT · Data Wrangler · Camera Trainee · Camera PA · Drone Operator · Gimbal Technician · Underwater Camera Operator · Video Assist Operator · Stills Photographer
**Grip** — Key Grip · Best Boy Grip · Dolly Grip · Grip · Rigging Grip · Crane/Technocrane Operator · Grip Trainee
**Electric / Lighting** — Gaffer (Chief Lighting Technician) · Best Boy Electric · Electrician/Lighting Technician · Lamp Operator · Generator Operator · Rigging Gaffer · Board/Console Operator · Electrical Trainee

### Sound
**Sound (Production)** — Production Sound Mixer · Boom Operator · Sound Assistant / Cable Person · Utility Sound Technician

### Art
**Art Department** — Production Designer · Supervising Art Director · Art Director · Assistant Art Director · Set Designer · Draughtsperson · Concept Artist · Storyboard Artist · Graphic Designer · Art Department Coordinator · Art Department Assistant
**Set Decoration** — Set Decorator · Assistant Set Decorator · Leadman · Set Dresser · On‑Set Dresser · Standby Set Dresser · Buyer
**Props** — Property Master · Assistant Property Master · Standby Props · Dressing Props · Props Maker · Armourer
**Construction** — Construction Manager · Construction Coordinator · Head Carpenter · Carpenter · Scenic Artist · Painter · Plasterer · Sculptor · Welder · Rigger · Stagehand
**Greens** — Greens Supervisor · Greensman · Greens Assistant

### Costume & Makeup
**Costume / Wardrobe** — Costume Designer · Assistant Costume Designer · Costume Supervisor · Key Costumer · Set Costumer · Wardrobe Assistant · Cutter/Maker · Seamstress/Tailor · Ager/Dyer · Buyer
**Hair & Makeup** — Hair & Makeup Designer · Key Makeup Artist · Makeup Artist · Key Hair Stylist · Hair Stylist · SFX/Prosthetics Makeup Artist · Prosthetics Technician · Daily Hair/Makeup Artist

### Effects & Stunts
**Special Effects (SFX)** — SFX Supervisor · SFX Coordinator · SFX Technician · Pyrotechnician · Model Maker
**Visual Effects (VFX)** — VFX Supervisor · VFX Producer · On‑Set VFX Supervisor · VFX Coordinator · VFX Data Wrangler · Matchmove Artist · Compositor · CG Artist · Roto/Paint Artist · Motion Capture Technician
**Stunts** — Stunt Coordinator · Assistant Stunt Coordinator · Stunt Performer · Stunt Double · Stunt Rigger · Fight Choreographer · Precision Driver

### Locations & Logistics
**Locations** — Location Manager · Assistant Location Manager · Location Scout · Unit Manager · Location Assistant · Location Marshal · Parking Coordinator
**Transportation** — Transportation Coordinator · Transportation Captain · Driver · Picture Car Coordinator · Picture Car Wrangler
**Catering / Craft Service** — Caterer · Chef · Catering Assistant · Craft Service
**Background / Extras** — Extras Casting Director · Background Coordinator · Extras Wrangler

### On‑set Support
**Health & Safety / Medical** — Set Medic · Health & Safety Advisor · COVID/Compliance Officer · Intimacy Coordinator · Safety Officer
**Coaching** — Dialect/Dialogue Coach · Acting Coach · Movement Coach · Choreographer
**Animals** — Animal Coordinator · Animal Wrangler · Animal Trainer · Veterinarian
**Marine / Aerial / Specialty** — Marine Coordinator · Aerial Coordinator · Pilot · Safety Diver
**Publicity / Stills** — Unit Publicist · Stills Photographer · EPK Crew · Behind‑the‑Scenes Videographer · Social Media Manager
**Security** — Security Coordinator · Security Guard · Site Security

### Post‑Production
**Editorial** — Post‑Production Supervisor · Editor · Co‑Editor · Additional Editor · 1st Assistant Editor · 2nd Assistant Editor · VFX Editor · Online/Conform Editor · DI Producer
**Colour / DI** — Colorist · Dailies Colorist · Dailies Operator
**Sound Post** — Supervising Sound Editor · Sound Designer · Dialogue Editor · ADR Editor · Foley Artist · Foley Editor · Sound Effects Editor · Re‑Recording Mixer · Music Editor
**Music** — Composer · Music Supervisor · Orchestrator · Conductor · Score Mixer · Music Producer

---

## Open questions before building
1. **Scope** — apply the cascading picker to the **Crew Directory** only, or also the **per‑project crew/assignment** form (which currently uses a fixed role enum)?
2. **Custom roles** — keep the always‑available "Other (type…)" escape hatch? (Recommended yes.)
3. **Editable later** — ship as a code constant now, with the option to move to an admin‑managed table in a later pass? (Recommended.)
