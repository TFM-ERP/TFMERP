-- CreateEnum
CREATE TYPE "Activity" AS ENUM ('RENTAL', 'PRODUCTION', 'BOTH');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'RENTAL_MANAGER', 'RENTAL_COORDINATOR', 'DISPATCHER', 'DRIVER', 'MAINTENANCE', 'PRODUCTION_MANAGER', 'PRODUCTION_COORDINATOR', 'CREW', 'HR_MANAGER', 'SALES', 'TALENT_REP', 'TRAVEL_COORDINATOR');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('AED', 'USD', 'EUR', 'GBP', 'SAR', 'CAD');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'SENT', 'VIEWED', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PROFORMA', 'TAX_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOIDED', 'REFUNDED', 'BAD_DEBT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CLEARED', 'BOUNCED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_APPROVED', 'PAID', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VatType" AS ENUM ('STANDARD', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'JOURNAL');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('ARTIST_TRAILER', 'STAR_TRAILER', 'MAKEUP_TRAILER', 'WARDROBE_TRAILER', 'MOBILE_TOILET', 'GENERATOR', 'WATER_TANK', 'WASTE_TANK', 'SUPPORT_VEHICLE', 'CREW_TRANSPORT', 'UTILITY_TRAILER', 'TRUCK', 'TOWING_VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ON_HIRE', 'IN_MAINTENANCE', 'OUT_OF_SERVICE', 'DAMAGED', 'IN_TRANSIT', 'RETIRED', 'SOLD');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('INQUIRY', 'QUOTED', 'AWAITING_PAYMENT', 'APPROVED', 'CONTRACT_SENT', 'CONTRACT_SIGNED', 'SCHEDULED', 'DISPATCHED', 'DELIVERED', 'ACTIVE', 'ON_HIRE', 'EXTENDED', 'PICKUP_SCHEDULED', 'RETURNED', 'INSPECTED', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'INSPECTION');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('REPORTED', 'SCHEDULED', 'PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'WAITING_FOR_PARTS', 'IN_PROGRESS', 'TESTING', 'COMPLETED', 'CLOSED', 'WARRANTY_CLAIM', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DriverType" AS ENUM ('EMPLOYEE', 'FREELANCE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'DELIVERED', 'PICKED_UP', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('VEHICLE_BREAKDOWN', 'TRAILER_ISSUE', 'GENERATOR_FAILURE', 'ACCIDENT', 'DELAY', 'SITE_ACCESS_ISSUE', 'EQUIPMENT_DAMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "SupplierDocType" AS ENUM ('TRADE_LICENSE', 'VAT_CERTIFICATE', 'INSURANCE', 'CONTRACT', 'BANK_DETAILS', 'QUOTATION', 'INVOICE', 'WARRANTY', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplierContactRole" AS ENUM ('SALES', 'FINANCE', 'OPERATIONS', 'TECHNICAL', 'MANAGEMENT', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DEVELOPMENT', 'PRE_PRODUCTION', 'PRODUCTION', 'POST_PRODUCTION', 'DELIVERED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BudgetVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'LOCKED', 'WORKING');

-- CreateEnum
CREATE TYPE "ProductionCrewRole" AS ENUM ('EXECUTIVE_PRODUCER', 'PRODUCER', 'LINE_PRODUCER', 'DIRECTOR', 'ASSISTANT_DIRECTOR', 'DOP', 'CAMERA_OPERATOR', 'GAFFER', 'GRIP', 'SOUND', 'ART_DIRECTOR', 'STYLIST', 'MAKEUP', 'WARDROBE', 'EDITOR', 'COLORIST', 'VFX_ARTIST', 'MUSIC_COMPOSER', 'PRODUCTION_COORDINATOR', 'PRODUCTION_ASSISTANT', 'DRIVER', 'OTHER');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('INT', 'EXT', 'STUDIO', 'BACKLOT', 'OTHER');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('SCOUTING', 'OPTION', 'CONFIRMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "MasterLocationStatus" AS ENUM ('PROSPECT', 'LIBRARY', 'PREFERRED', 'RESTRICTED', 'BLACKLISTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LocationMediaType" AS ENUM ('PHOTO', 'VIDEO', 'PANO360', 'DRONE', 'FLOORPLAN', 'CAD', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ScoutAssignmentType" AS ENUM ('INITIAL', 'PHOTO', 'DIRECTOR', 'PRODUCER', 'TECH_RECCE', 'PERMIT', 'FINAL');

-- CreateEnum
CREATE TYPE "ScoutPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ScoutAssignmentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScoutSubmissionStatus" AS ENUM ('PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecceStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvaluationRecommendation" AS ENUM ('RECOMMENDED', 'ACCEPTABLE', 'NOT_RECOMMENDED');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('NOT_REQUIRED', 'DRAFT', 'APPLIED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LocationPermitType" AS ENUM ('GROUND_FILMING', 'DRONE_GCAA', 'ROAD_TRAFFIC', 'POLICE', 'AIRPORT', 'HERITAGE_DCT', 'PARKING', 'MARINE', 'PYRO_SFX', 'FIREARMS', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MITIGATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LocationDocCategory" AS ENUM ('NOC', 'LOCATION_AGREEMENT', 'RELEASE', 'INSURANCE', 'LOCATION_GUIDE', 'RISK_ASSESSMENT', 'METHOD_STATEMENT', 'ID_DOCUMENT', 'QUOTE', 'PERMIT_DOC', 'OTHER');

-- CreateEnum
CREATE TYPE "LocationDocStatus" AS ENUM ('DRAFT', 'REQUESTED', 'RECEIVED', 'SIGNED', 'ISSUED', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "DocLanguage" AS ENUM ('EN', 'AR', 'BILINGUAL');

-- CreateEnum
CREATE TYPE "LocationStage" AS ENUM ('SOURCING', 'NOC_REQUESTED', 'AGREEMENT_SENT', 'PERMIT_APPLIED', 'INSURANCE_RECEIVED', 'CONFIRMED', 'WRAPPED');

-- CreateEnum
CREATE TYPE "SecurityStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'ON_SITE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationPaymentKind" AS ENUM ('QUOTE', 'DEPOSIT', 'BALANCE', 'ADDITIONAL', 'REFUND');

-- CreateEnum
CREATE TYPE "LocationPaymentStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID');

-- CreateEnum
CREATE TYPE "StripIntExt" AS ENUM ('INT', 'EXT', 'INT_EXT');

-- CreateEnum
CREATE TYPE "StripDayNight" AS ENUM ('DAY', 'NIGHT', 'DUSK', 'DAWN');

-- CreateEnum
CREATE TYPE "BreakdownCategory" AS ENUM ('CAST', 'BACKGROUND', 'STUNTS', 'VEHICLES', 'ANIMALS', 'ANIMAL_WRANGLER', 'PROPS', 'SET_DRESSING', 'WARDROBE', 'MAKEUP_HAIR', 'SFX', 'MECHANICAL_FX', 'VFX', 'SPECIAL_EQUIPMENT', 'CAMERA', 'ADDITIONAL_LABOR', 'SOUND_MUSIC', 'ART', 'GREENERY', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectTxnKind" AS ENUM ('INCOME', 'COST', 'SALES_REVENUE', 'CORPORATE_OVERHEAD');

-- CreateEnum
CREATE TYPE "ProjectTxnStatus" AS ENUM ('DRAFT', 'APPROVED', 'INVOICED', 'PAID', 'RECEIVED', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceClassification" AS ENUM ('B2B', 'B2C', 'B2G');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "BankReconStatus" AS ENUM ('OPEN', 'RECONCILED');

-- CreateEnum
CREATE TYPE "DprStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "CashAdvanceStatus" AS ENUM ('OUTSTANDING', 'PARTIALLY_CLEARED', 'CLEARED', 'RETURNED');

-- CreateEnum
CREATE TYPE "CardTxnStatus" AS ENUM ('UNRECONCILED', 'CODED', 'POSTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'PARTIALLY_INVOICED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PendingVendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PettyCashTxnType" AS ENUM ('TOPUP', 'SPEND');

-- CreateEnum
CREATE TYPE "OverageStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PerDiemStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "CallSheetStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "GlAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LineItemOrigin" AS ENUM ('MANUAL', 'AI_GENERATED', 'SCRIPT_IMPORT', 'SCRIPT_TAG', 'AUTO_BREAKDOWN', 'MANUAL_OVERRIDE', 'MOVIE_MAGIC_IMPORT');

-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('AUTO_WORKSHOP', 'CARAVAN_REPAIR', 'GENERATOR_REPAIR', 'ELECTRICAL_REPAIR', 'AC_REPAIR', 'TIRE_SUPPLIER', 'SPARE_PARTS_SUPPLIER', 'STRUCTURAL_REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorJobStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorJobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "VendorDocType" AS ENUM ('TRADE_LICENSE', 'VAT_CERTIFICATE', 'CONTRACT', 'INSURANCE', 'QUOTATION', 'INVOICE', 'INSPECTION_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorInvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorPaymentStatus" AS ENUM ('PENDING', 'CLEARED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('CREW_MEMBER', 'VENDOR_EMPLOYEE', 'CLIENT_EMPLOYEE', 'WORKSHOP_EMPLOYEE', 'DRIVER_CONTACT', 'SUPPLIER_EMPLOYEE', 'FREELANCER', 'OTHER');

-- CreateEnum
CREATE TYPE "GeoLevel" AS ENUM ('COUNTRY', 'STATE', 'REGION', 'DISTRICT', 'CITY', 'ZONE');

-- CreateEnum
CREATE TYPE "LaborBodyKind" AS ENUM ('UNION', 'GUILD', 'STATUTORY', 'PAYROLL_PROVIDER');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('PENSION', 'HEALTH', 'PENSION_HEALTH', 'PAYROLL_TAX', 'WORKERS_COMP', 'UNEMPLOYMENT', 'VACATION_PAY', 'HOLIDAY_PAY', 'EMPLOYER_TAX', 'UNION_DUES', 'GUILD_CONTRIB', 'STATUTORY_GRATUITY', 'HANDLING_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "CalcMethod" AS ENUM ('PERCENT', 'FLAT_PER_DAY', 'FLAT_PER_WEEK', 'FLAT_PER_HOUR', 'PERCENT_WITH_CAP', 'TIERED');

-- CreateEnum
CREATE TYPE "RateBase" AS ENUM ('GROSS', 'STRAIGHT_TIME', 'TAXABLE', 'WORKED_DAYS');

-- CreateEnum
CREATE TYPE "CapPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'ANNUAL', 'PER_PRODUCTION');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UnionStatus" AS ENUM ('UNION', 'NON_UNION', 'MIXED');

-- CreateEnum
CREATE TYPE "IncentiveType" AS ENUM ('TAX_CREDIT', 'REBATE', 'CASH_REBATE', 'GRANT', 'EXEMPTION');

-- CreateEnum
CREATE TYPE "WorkflowEntity" AS ENUM ('INVOICE', 'EXPENSE', 'PURCHASE_ORDER', 'PETTY_CASH', 'TIMECARD', 'CONTRACT', 'TRIP', 'BUDGET_TRANSFER', 'OVERAGE', 'BUDGET_CHANGE', 'SCHEDULE_CHANGE', 'LOCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'BOOKING_IN_PROGRESS', 'BOOKED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TravelBookingStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('REQUIRED', 'NOT_REQUIRED', 'SUBMITTED', 'IN_PROCESS', 'APPROVED', 'ISSUED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VisaType" AS ENUM ('US_O1', 'US_O2', 'US_B1_B2', 'UK_CREATIVE_WORKER', 'UK_STANDARD_VISITOR', 'SCHENGEN_C', 'UAE_EMPLOYMENT', 'UAE_MISSION', 'INDIA_EMPLOYMENT', 'INDIA_BUSINESS_EVISA', 'OTHER');

-- CreateEnum
CREATE TYPE "TravelSupplierType" AS ENUM ('AIRLINE', 'HOTEL', 'CAR_RENTAL', 'AGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "TravelerPersonType" AS ENUM ('TALENT', 'ACCOMPANYING', 'CREW', 'CONSULTANT', 'VIP');

-- CreateEnum
CREATE TYPE "TravelerVisaStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TravelerDocType" AS ENUM ('PASSPORT', 'VISA', 'NATIONAL_ID', 'EMIRATES_ID', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT', 'ENTRY_PERMIT', 'VACCINATION', 'INSURANCE', 'FLIGHT_ITINERARY', 'HOTEL_VOUCHER', 'INVITATION_LETTER', 'WORK_PERMIT', 'PERMIT_APPROVAL', 'CUSTOMS', 'OTHER');

-- CreateEnum
CREATE TYPE "ArrivalStatus" AS ENUM ('SCHEDULED', 'LANDED', 'COLLECTED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('DEAL_MEMO', 'CREW_AGREEMENT', 'TALENT_AGREEMENT', 'SERVICE_AGREEMENT', 'NDA', 'LOCATION_AGREEMENT', 'VENDOR_AGREEMENT', 'RELEASE_FORM', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContractPartyRole" AS ENUM ('COMPANY', 'CONTRACTOR', 'TALENT', 'CREW', 'VENDOR', 'WITNESS', 'GUARANTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'VIEWED', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SignatureMethod" AS ENUM ('ESIGN', 'WET_INK', 'CLICKWRAP');

-- CreateEnum
CREATE TYPE "SignatureEvent" AS ENUM ('CREATED', 'SENT', 'DELIVERED', 'VIEWED', 'SIGNED', 'DECLINED', 'REMINDER_SENT', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "TalentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "CastingRoleType" AS ENUM ('LEAD', 'SUPPORTING', 'FEATURED', 'DAY_PLAYER', 'BACKGROUND', 'STUNT', 'VOICE', 'STAND_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "CastingCallStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_REVIEW', 'SHORTLISTED', 'CALLBACKS', 'OFFER', 'CAST', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'CALLBACK', 'OFFERED', 'CONFIRMED', 'DECLINED', 'WITHDRAWN', 'DRAFT', 'OPEN', 'PUBLIC', 'INVITED', 'CASTING_ASSISTANT_REVIEW', 'CASTING_DIRECTOR_REVIEW', 'PRODUCER_REVIEW', 'DIRECTOR_REVIEW', 'STUDIO_REVIEW', 'CHEMISTRY_READ', 'NEGOTIATION', 'DEAL_MEMO_PENDING', 'DEAL_MEMO_SIGNED', 'TRAVEL_PENDING', 'VISA_PENDING', 'BOOKED', 'ON_SET', 'WRAPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionSource" AS ENUM ('SELF', 'AGENT', 'SCOUTED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "BoardVerdict" AS ENUM ('APPROVED', 'MAYBE', 'PASS', 'CALLBACK', 'CHEMISTRY_READ');

-- CreateEnum
CREATE TYPE "AuditionType" AS ENUM ('SELF_TAPE', 'IN_PERSON', 'VIRTUAL', 'CALLBACK', 'CHEMISTRY_READ');

-- CreateEnum
CREATE TYPE "AuditionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('DATA_PROCESSING', 'IMAGE_LIKENESS', 'MINOR_GUARDIAN', 'BACKGROUND_CHECK', 'MARKETING');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('OPEN', 'COUNTERED', 'AGREED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VendorRanking" AS ENUM ('PREFERRED', 'APPROVED', 'RESTRICTED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "AccommodationType" AS ENUM ('HOTEL', 'APARTMENT', 'SERVICED_APARTMENT', 'VILLA', 'RESORT', 'CREW_CAMP', 'DORMITORY', 'STAFF_HOUSING', 'OTHER');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'EXECUTIVE_SUITE', 'VILLA', 'APARTMENT', 'DORMITORY', 'BED');

-- CreateEnum
CREATE TYPE "AccommodationClass" AS ENUM ('STANDARD', 'BUSINESS', 'EXECUTIVE', 'VIP', 'ULTRA_VIP');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'BLOCKED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AccommodationStatus" AS ENUM ('REQUESTED', 'RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportVehicleSource" AS ENUM ('IN_HOUSE', 'HIRED');

-- CreateEnum
CREATE TYPE "TransportVehicleType" AS ENUM ('SEDAN', 'SUV', 'VAN', 'MINIBUS', 'BUS', 'LUXURY', 'PICKUP', 'TRUCK', 'PRODUCTION_VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransportDriverSource" AS ENUM ('IN_HOUSE', 'HIRED', 'FREELANCE');

-- CreateEnum
CREATE TYPE "TransportOrderType" AS ENUM ('TALENT_PICKUP', 'CREW_SHUTTLE', 'AIRPORT_PICKUP', 'AIRPORT_DROPOFF', 'EQUIPMENT_RUN', 'INTER_LOCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TransportStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'EN_ROUTE', 'PASSENGER_ONBOARD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportFleetClass" AS ENUM ('WORKING', 'PASSENGER', 'PICTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "RouteKind" AS ENUM ('STANDARD', 'TRUCK_SAFE', 'NOISE_RESTRICTED', 'SCENIC', 'AVOID');

-- CreateEnum
CREATE TYPE "ShuttleFrequency" AS ENUM ('DAILY', 'WEEKDAYS', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RepresentationType" AS ENUM ('AGENCY', 'MANAGER', 'LAWYER', 'PUBLICIST', 'BUSINESS_MANAGER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('FILM', 'TV', 'COMMERCIAL', 'THEATRE', 'OTHER');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('MEETING', 'PHONE_CALL', 'VIDEO_CALL', 'FESTIVAL_MEETING', 'SCRIPT_SENT', 'AUDITION_INVITE', 'CALLBACK_INVITE', 'OFFER_MADE', 'OFFER_DECLINED', 'BOOKING_CONFIRMED', 'CONTRACT_SIGNED', 'EMAIL', 'NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "ChannelScope" AS ENUM ('COMPANY', 'BUSINESS_UNIT', 'PROJECT', 'UNIT', 'TEAM', 'DEPARTMENT', 'JOB', 'TRIP', 'DM', 'BROADCAST', 'PTT');

-- CreateEnum
CREATE TYPE "ChannelMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'VOICE', 'PHOTO', 'VIDEO', 'FILE', 'LOCATION', 'ENTITY_CARD', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'FILE');

-- CreateEnum
CREATE TYPE "PttSessionStatus" AS ENUM ('LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('PRE_PRODUCTION', 'PRODUCTION', 'DEPARTMENT', 'TONE', 'CONCEPT', 'SAFETY', 'TECH_RECCE', 'WRAP', 'OTHER');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgendaItemKind" AS ENUM ('INFO', 'ACTION', 'DISCUSSION');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('ON_SHIFT', 'ON_BREAK', 'OFF_SHIFT');

-- CreateEnum
CREATE TYPE "GeofenceKind" AS ENUM ('BASECAMP', 'CREW_PARKING', 'CATERING', 'UNIT_BASE', 'SET', 'OTHER');

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "toBase" DECIMAL(14,6) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountName" TEXT,
    "accountEmail" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "passwordHash" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ACCOUNTANT',
    "activity" "Activity" NOT NULL DEFAULT 'BOTH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "approvalLimit" DECIMAL(15,2),
    "avatarUrl" TEXT,
    "legalName" TEXT,
    "preferredName" TEXT,
    "legalNameProposed" TEXT,
    "legalNamePending" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_backup_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownShare" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refKey" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "sharedById" TEXT NOT NULL,
    "sharedToId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakdownShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "fieldLevelAccess" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_role_assignments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "notes" TEXT,
    "costTreatment" TEXT NOT NULL DEFAULT 'COMPANY_OVERHEAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'PII_REVEAL',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "verifiedAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "tradeName" TEXT,
    "trn" TEXT,
    "billingAddress" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'UAE',
    "website" TEXT,
    "creditLimit" DECIMAL(15,2),
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "blockReason" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactName" TEXT,
    "address" TEXT,
    "googleMapsUrl" TEXT,
    "vatId" TEXT,
    "tradeLicenseNumber" TEXT,
    "tradeLicenseExpiry" TIMESTAMP(3),
    "tradeLicenseUrl" TEXT,
    "vatCertificateUrl" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "iban" TEXT,
    "swiftCode" TEXT,
    "bankBranch" TEXT,
    "bankAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_documents" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branch" TEXT,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT,
    "swiftCode" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "bankAddress" TEXT,
    "qrPaymentData" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefaultInvoice" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultQuotation" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultReceiving" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "vatType" "VatType" NOT NULL DEFAULT 'STANDARD',
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'Service',
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "costCenterId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "activity" "Activity" NOT NULL DEFAULT 'RENTAL',
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountType" TEXT,
    "discountValue" DECIMAL(15,2),
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deductionReason" TEXT,
    "deductionAppliedById" TEXT,
    "deductionAppliedAt" TIMESTAMP(3),
    "vatAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vatDisplay" TEXT NOT NULL DEFAULT 'SEPARATE',
    "vatNote" TEXT,
    "subject" TEXT,
    "notes" TEXT,
    "termsConditions" TEXT,
    "internalNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "clientApprovedAt" TIMESTAMP(3),
    "clientRejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'ASSET',
    "serviceItemId" TEXT,
    "description" TEXT NOT NULL,
    "details" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "days" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(15,2) NOT NULL,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "quotationId" TEXT,
    "activity" "Activity" NOT NULL DEFAULT 'RENTAL',
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'TAX_INVOICE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deductionReason" TEXT,
    "deductionAppliedById" TEXT,
    "deductionAppliedAt" TIMESTAMP(3),
    "vatAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vatDisplay" TEXT NOT NULL DEFAULT 'SEPARATE',
    "subject" TEXT,
    "notes" TEXT,
    "termsConditions" TEXT,
    "internalNotes" TEXT,
    "poNumber" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookingId" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'ASSET',
    "serviceItemId" TEXT,
    "description" TEXT NOT NULL,
    "details" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "days" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(15,2) NOT NULL,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "notes" TEXT,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "activity" "Activity" NOT NULL DEFAULT 'RENTAL',
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "vatAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "receiptUrl" TEXT,
    "notes" TEXT,
    "projectRef" TEXT,
    "productionAccountCode" TEXT,
    "vendorName" TEXT,
    "supplierVatId" TEXT,
    "supplierId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "category" TEXT,
    "serialNumber" TEXT,
    "specs" JSONB,
    "warrantyExpiry" TIMESTAMP(3),
    "warrantyProvider" TEXT,
    "plateNumber" TEXT,
    "plateEmirate" TEXT,
    "vinNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseValue" DECIMAL(15,2),
    "currentValue" DECIMAL(15,2),
    "depreciation" DECIMAL(5,2),
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "photos" TEXT[],
    "tilePhoto" TEXT,
    "notes" TEXT,
    "qrCode" TEXT,
    "tracksMileage" BOOLEAN NOT NULL DEFAULT false,
    "currentOdometer" INTEGER,
    "currentEngineHours" INTEGER,
    "registrationExpiry" TIMESTAMP(3),
    "registrationDocUrl" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "insurancePolicyRef" TEXT,
    "insuranceDocUrl" TEXT,
    "trailerSpecs" JSONB,
    "linkedGeneratorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "driverType" "DriverType" NOT NULL DEFAULT 'EMPLOYEE',
    "mobile" TEXT,
    "email" TEXT,
    "emiratesId" TEXT,
    "emiratesIdExpiry" TIMESTAMP(3),
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "licenseClass" TEXT,
    "visaExpiry" TIMESTAMP(3),
    "bankName" TEXT,
    "bankAccount" TEXT,
    "iban" TEXT,
    "dailyRate" DECIMAL(10,2),
    "weeklyRate" DECIMAL(10,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "photoUrl" TEXT,
    "emiratesIdDocUrl" TEXT,
    "passportDocUrl" TEXT,
    "licenseDocUrl" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_payouts" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "jobIds" TEXT[],
    "lineItems" JSONB,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "bankAccountId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_jobs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "assetId" TEXT,
    "jobType" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'ASSIGNED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pickupLocation" TEXT,
    "dropoffLocation" TEXT,
    "destinationUrl" TEXT,
    "bookingLocationId" TEXT,
    "gpsOnArrival" TEXT,
    "deliveryPhotos" TEXT[],
    "pickupPhotos" TEXT[],
    "driverNotes" TEXT,
    "fuelExpense" DECIMAL(10,2),
    "tollExpense" DECIMAL(10,2),
    "parkingExpense" DECIMAL(10,2),
    "foodAllowance" DECIMAL(10,2),
    "otherExpense" DECIMAL(10,2),
    "signatureUrl" TEXT,
    "receiptPhotoUrls" TEXT[],
    "equipmentChecklist" JSONB,
    "bonusAmount" DECIMAL(10,2),
    "bonusNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_bookings" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quotationId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'INQUIRY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "pickupDate" TIMESTAMP(3),
    "deliveryAddress" TEXT,
    "deliveryCity" TEXT,
    "deliveryLocationUrl" TEXT,
    "deliveryNotes" TEXT,
    "pickupAddress" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(15,2),
    "notes" TEXT,
    "internalNotes" TEXT,
    "poNumber" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'day',
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 1,
    "lineTotal" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "bookingLocationId" TEXT,
    "towedById" TEXT,
    "checkoutOdometer" INTEGER,
    "returnOdometer" INTEGER,
    "checkoutAt" TIMESTAMP(3),
    "returnAt" TIMESTAMP(3),
    "mileageAllowanceKm" INTEGER,
    "allocationStatus" TEXT NOT NULL DEFAULT 'RESERVED',
    "substitutionStatus" TEXT,
    "substitutedFromAssetId" TEXT,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tow_couplings" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "trailerItemId" TEXT NOT NULL,
    "towVehicleItemId" TEXT,
    "externalTow" BOOLEAN NOT NULL DEFAULT false,
    "hitchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hitchedBy" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "unhitchedAt" TIMESTAMP(3),
    "unhitchedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "tow_couplings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "terms" TEXT,
    "cancellationPolicy" TEXT,
    "liabilityClauses" TEXT,
    "damageDepositClause" TEXT,
    "paymentTerms" TEXT,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedByName" TEXT,
    "signedPdfUrl" TEXT,
    "signatureData" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL DEFAULT 'PREVENTIVE',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'REPORTED',
    "description" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "cost" DECIMAL(10,2),
    "vendorName" TEXT,
    "invoiceRef" TEXT,
    "partsReplaced" TEXT,
    "technicianNotes" TEXT,
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceKm" INTEGER,
    "downTimeDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_logs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "transportVehicleId" TEXT,
    "projectId" TEXT,
    "transportDriverId" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "litres" DECIMAL(8,2) NOT NULL,
    "costPerLitre" DECIMAL(6,3) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "odometer" INTEGER,
    "runtimeHours" DECIMAL(8,2),
    "receiptUrl" TEXT,
    "notes" TEXT,
    "bookingRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_reports" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "bookingId" TEXT,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MINOR',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "gpsLocation" TEXT,
    "photos" TEXT[],
    "videos" TEXT[],
    "clientLiable" BOOLEAN NOT NULL DEFAULT false,
    "repairCost" DECIMAL(10,2),
    "insuranceClaim" BOOLEAN NOT NULL DEFAULT false,
    "claimRef" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "damage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "incidentType" "IncidentType" NOT NULL,
    "urgency" "IncidentUrgency" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "gpsLocation" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photos" TEXT[],
    "driverId" TEXT,
    "assetId" TEXT,
    "bookingId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "resolutionCost" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "category" TEXT,
    "categories" TEXT[],
    "googleMapsUrl" TEXT,
    "gpsCoordinates" TEXT,
    "vendorId" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trn" TEXT,
    "vatId" TEXT,
    "trnCertificateUrl" TEXT,
    "tradeLicenseNumber" TEXT,
    "tradeLicenseExpiry" TIMESTAMP(3),
    "tradeLicenseUrl" TEXT,
    "businessLicenseUrl" TEXT,
    "insuranceDocUrl" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "contractExpiry" TIMESTAMP(3),
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'UAE',
    "website" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "iban" TEXT,
    "swiftCode" TEXT,
    "routingNumber" TEXT,
    "bankBranch" TEXT,
    "bankAddress" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "paymentTermDays" INTEGER,
    "creditLimit" DECIMAL(15,2),
    "notes" TEXT,
    "blacklistReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ranking" "VendorRanking",

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "globalContactId" TEXT,
    "fullName" TEXT NOT NULL,
    "role" "SupplierContactRole" NOT NULL DEFAULT 'OTHER',
    "jobTitle" TEXT,
    "department" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "officePhone" TEXT,
    "preferredContact" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_documents" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "docType" "SupplierDocType" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_projects" (
    "id" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT,
    "agencyName" TEXT,
    "brandName" TEXT,
    "projectType" TEXT NOT NULL DEFAULT 'TVC',
    "status" "ProductionStatus" NOT NULL DEFAULT 'DEVELOPMENT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "shootStartDate" TIMESTAMP(3),
    "shootEndDate" TIMESTAMP(3),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "totalBudget" DECIMAL(15,2),
    "productionCountryId" TEXT,
    "emailSettings" JSONB,
    "logoUrl" TEXT,
    "posterUrl" TEXT,
    "posterTransform" JSONB,
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "perDiemInternational" DECIMAL(12,2),
    "perDiemDomestic" DECIMAL(12,2),
    "isHouse" BOOLEAN NOT NULL DEFAULT false,
    "scheduleConfig" JSONB,

    CONSTRAINT "production_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_globals_staging" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prepDays" INTEGER,
    "shootDays" INTEGER,
    "wrapDays" INTEGER,
    "crewCount" INTEGER,
    "eurToAed" DECIMAL(14,6),
    "usdToAed" DECIMAL(14,6),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pushedAt" TIMESTAMP(3),
    "pushedToVersionId" TEXT,
    "doodTallies" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_globals_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coa_mapping_table" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'MOVIE_MAGIC',
    "externalCode" TEXT NOT NULL,
    "externalLabel" TEXT,
    "masterCode" TEXT NOT NULL,
    "masterTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coa_mapping_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_locations" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "aliases" JSONB,
    "category" "LocationType" NOT NULL DEFAULT 'EXT',
    "subType" TEXT,
    "status" "MasterLocationStatus" NOT NULL DEFAULT 'LIBRARY',
    "summary" TEXT,
    "tags" JSONB,
    "country" TEXT DEFAULT 'United Arab Emirates',
    "region" TEXT,
    "city" TEXT,
    "district" TEXT,
    "fullAddress" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "googleMapsUrl" TEXT,
    "what3words" TEXT,
    "timezone" TEXT,
    "accessNotes" TEXT,
    "parkingNotes" TEXT,
    "basecampNotes" TEXT,
    "nearestAirport" TEXT,
    "driveTimeNotes" TEXT,
    "powerAvailable" BOOLEAN,
    "powerNotes" TEXT,
    "internetNotes" TEXT,
    "cellularNotes" TEXT,
    "waterAvailable" BOOLEAN,
    "soundNotes" TEXT,
    "ceilingHeightM" DECIMAL(6,2),
    "floorAreaSqm" DECIMAL(12,2),
    "ownerName" TEXT,
    "ownerCompany" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "agentName" TEXT,
    "agentPhone" TEXT,
    "restrictions" TEXT,
    "permitAuthority" TEXT,
    "standardFee" DECIMAL(14,2),
    "feeCurrency" TEXT NOT NULL DEFAULT 'AED',
    "feeNotes" TEXT,
    "nearestHospitalName" TEXT,
    "nearestHospitalAddress" TEXT,
    "nearestHospitalPhone" TEXT,
    "safetyNotes" TEXT,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "totalSpentToDate" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "avgFeePerDay" DECIMAL(14,2),
    "historyNotes" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_media" (
    "id" TEXT NOT NULL,
    "masterLocationId" TEXT NOT NULL,
    "type" "LocationMediaType" NOT NULL DEFAULT 'PHOTO',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "masterLocationId" TEXT,
    "scenes" TEXT,
    "shootStart" TIMESTAMP(3),
    "shootEnd" TIMESTAMP(3),
    "pipelineStage" "LocationStage" NOT NULL DEFAULT 'SOURCING',
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'EXT',
    "status" "LocationStatus" NOT NULL DEFAULT 'SCOUTING',
    "country" TEXT DEFAULT 'United Arab Emirates',
    "emirate" TEXT,
    "area" TEXT,
    "fullAddress" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "googleMapsUrl" TEXT,
    "what3words" TEXT,
    "locationManagerId" TEXT,
    "locationAssistantId" TEXT,
    "ownerContactName" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "parkingNotes" TEXT,
    "basecampNotes" TEXT,
    "accessNotes" TEXT,
    "facilities" JSONB,
    "restrictions" TEXT,
    "nearestHospitalName" TEXT,
    "nearestHospitalAddress" TEXT,
    "nearestHospitalPhone" TEXT,
    "locationFeePerDay" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "permitRequired" BOOLEAN NOT NULL DEFAULT false,
    "permitStatus" TEXT,
    "permitNumber" TEXT,
    "permitExpiry" TIMESTAMP(3),
    "permitDocUrl" TEXT,
    "photoUrls" JSONB,
    "documentUrls" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_needs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "intExt" TEXT,
    "sceneRefs" TEXT,
    "brief" TEXT,
    "visualRefs" JSONB,
    "requiredBy" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SOURCING',
    "selectedOptionId" TEXT,
    "signOffStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "signOffBy" TEXT,
    "signOffAt" TIMESTAMP(3),
    "signOffNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_need_options" (
    "id" TEXT NOT NULL,
    "needId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "optionStatus" TEXT NOT NULL DEFAULT 'PROPOSED',
    "rank" INTEGER,
    "notes" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_need_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_visits" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "masterLocationId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RECON',
    "purpose" TEXT,
    "date" TIMESTAMP(3),
    "callTime" TEXT,
    "meetingPoint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "transportRequested" BOOLEAN NOT NULL DEFAULT false,
    "transportOrderId" TEXT,
    "clearancePackId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scout_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_visit_stops" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "needId" TEXT,
    "locationId" TEXT,
    "label" TEXT,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "arriveAt" TEXT,
    "departAt" TEXT,
    "notes" TEXT,
    "techRecceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scout_visit_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_visit_members" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "crewId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "roleTitle" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scout_visit_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_packs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "visitId" TEXT,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "recipientName" TEXT,
    "recipientOrg" TEXT,
    "recipientEmail" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sharedAt" TIMESTAMP(3),
    "message" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clearance_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_pack_members" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "crewId" TEXT,
    "name" TEXT NOT NULL,
    "roleTitle" TEXT,
    "department" TEXT,
    "passportUrl" TEXT,
    "emiratesIdUrl" TEXT,
    "photoUrl" TEXT,
    "otherDocs" JSONB,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clearance_pack_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_pack_accesses" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actor" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clearance_pack_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_assignments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sceneRefs" TEXT,
    "visualRefs" JSONB,
    "locationType" "LocationType" NOT NULL DEFAULT 'EXT',
    "budgetTarget" DECIMAL(14,2),
    "feeCurrency" TEXT NOT NULL DEFAULT 'AED',
    "dueDate" TIMESTAMP(3),
    "priority" "ScoutPriority" NOT NULL DEFAULT 'MEDIUM',
    "type" "ScoutAssignmentType" NOT NULL DEFAULT 'INITIAL',
    "status" "ScoutAssignmentStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scout_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_submissions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "summary" TEXT,
    "notes" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "fullAddress" TEXT,
    "googleMapsUrl" TEXT,
    "what3words" TEXT,
    "media" JSONB,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "evaluation" JSONB,
    "estFeePerDay" DECIMAL(14,2),
    "status" "ScoutSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedMasterLocationId" TEXT,
    "reviewNotes" TEXT,
    "submittedById" TEXT,
    "submittedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scout_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_recces" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "reccedAt" TIMESTAMP(3),
    "conductedBy" TEXT,
    "attendees" TEXT,
    "summary" TEXT,
    "status" "RecceStatus" NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tech_recces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recce_notes" (
    "id" TEXT NOT NULL,
    "techRecceId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "risks" TEXT,
    "equipmentNeeds" TEXT,
    "crewNeeds" TEXT,
    "accessNotes" TEXT,
    "safetyNotes" TEXT,
    "powerNotes" TEXT,
    "photos" JSONB,
    "note" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "actionItem" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "checklist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recce_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_evaluations" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "weights" JSONB,
    "weightedScore" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "recommendation" "EvaluationRecommendation" NOT NULL DEFAULT 'ACCEPTABLE',
    "notes" TEXT,
    "evaluatedById" TEXT,
    "evaluatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_plates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "locationId" TEXT,
    "visitId" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'WIDE',
    "caption" TEXT,
    "department" TEXT,
    "timeOfDay" TEXT,
    "sceneRef" TEXT,
    "shotRef" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_plates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_change_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationId" TEXT,
    "needId" TEXT,
    "visitId" TEXT,
    "recceNoteId" TEXT,
    "sceneRefs" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "reason" TEXT,
    "department" TEXT,
    "raisedBy" TEXT,
    "raisedByName" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_permits" (
    "id" TEXT NOT NULL,
    "locationId" TEXT,
    "masterLocationId" TEXT,
    "permitType" "LocationPermitType" NOT NULL DEFAULT 'OTHER',
    "type" TEXT,
    "authorityId" TEXT,
    "authority" TEXT,
    "jurisdiction" TEXT,
    "referenceNumber" TEXT,
    "status" "PermitStatus" NOT NULL DEFAULT 'DRAFT',
    "applicationDate" TIMESTAMP(3),
    "approvalDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fee" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "conditions" TEXT,
    "docUrl" TEXT,
    "ocrData" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_authorities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "jurisdiction" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "portalUrl" TEXT,
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_risks" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hazard" TEXT NOT NULL,
    "likelihood" INTEGER NOT NULL DEFAULT 1,
    "impact" INTEGER NOT NULL DEFAULT 1,
    "riskScore" INTEGER NOT NULL DEFAULT 1,
    "mitigation" TEXT,
    "owner" TEXT,
    "emergencyProcedure" TEXT,
    "nearestMedical" TEXT,
    "evacuationNotes" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_documents" (
    "id" TEXT NOT NULL,
    "locationId" TEXT,
    "masterLocationId" TEXT,
    "category" "LocationDocCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "status" "LocationDocStatus" NOT NULL DEFAULT 'DRAFT',
    "language" "DocLanguage" NOT NULL DEFAULT 'EN',
    "partyName" TEXT,
    "authority" TEXT,
    "refNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "signedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "fileUrl" TEXT,
    "ocrData" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_security" (
    "id" TEXT NOT NULL,
    "locationId" TEXT,
    "masterLocationId" TEXT,
    "company" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "guards" INTEGER NOT NULL DEFAULT 0,
    "marshals" INTEGER NOT NULL DEFAULT 0,
    "shiftStart" TIMESTAMP(3),
    "shiftEnd" TIMESTAMP(3),
    "days" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "ratePerGuard" DECIMAL(12,2),
    "totalCost" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "status" "SecurityStatus" NOT NULL DEFAULT 'PLANNED',
    "postedTxnId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_payments" (
    "id" TEXT NOT NULL,
    "locationId" TEXT,
    "masterLocationId" TEXT,
    "kind" "LocationPaymentKind" NOT NULL DEFAULT 'BALANCE',
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "status" "LocationPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceRef" TEXT,
    "payeeName" TEXT,
    "postedTxnId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timecards" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "classificationCode" TEXT,
    "accountCode" TEXT,
    "accountTitle" TEXT,
    "weekEnding" TIMESTAMP(3),
    "days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "dailyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "otRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "boxRental" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kitRental" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "perDiemDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "perDiemRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "gross" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fringe" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "postedTxnId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payrollRunId" TEXT,

    CONSTRAINT "timecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FILE',
    "provider" TEXT NOT NULL DEFAULT 'UPLOAD',
    "url" TEXT NOT NULL,
    "category" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "entityType" TEXT,
    "entityId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_strips" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneNumber" TEXT,
    "intExt" "StripIntExt" NOT NULL DEFAULT 'INT',
    "dayNight" "StripDayNight" NOT NULL DEFAULT 'DAY',
    "setName" TEXT,
    "location" TEXT,
    "locationId" TEXT,
    "description" TEXT,
    "pages" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "cast" JSONB,
    "estMinutes" INTEGER,
    "shootDay" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isBanner" BOOLEAN NOT NULL DEFAULT false,
    "bannerText" TEXT,

    CONSTRAINT "production_strips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_scenarios" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'SNAPSHOT',
    "strips" JSONB NOT NULL,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_documents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SCRIPT',
    "activeRevisionId" TEXT,
    "masterScriptId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_scripts" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'FEATURE',
    "writer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DEVELOPMENT',
    "summary" TEXT,
    "tags" JSONB,
    "tagPalette" JSONB,
    "voicePalette" JSONB,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_script_revisions" (
    "id" TEXT NOT NULL,
    "masterScriptId" TEXT NOT NULL,
    "revisionLabel" TEXT NOT NULL,
    "colorCode" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "pageText" JSONB,
    "scenes" JSONB,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_script_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_audio_notes" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "page" INTEGER,
    "label" TEXT,
    "audioUrl" TEXT NOT NULL,
    "durationSec" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_audio_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_engines" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STUDIO',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "credentialRef" TEXT,
    "baseUrl" TEXT,
    "capabilities" JSONB,
    "defaultModel" TEXT,
    "supportsCloning" BOOLEAN NOT NULL DEFAULT false,
    "costModel" JSONB,
    "rateLimit" JSONB,
    "roleAllowList" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_engines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_routing_policies" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ORG',
    "projectId" TEXT,
    "capability" TEXT NOT NULL,
    "defaultEngineId" TEXT,
    "allowedEngineIds" JSONB,
    "fallbackChain" JSONB,
    "projectOverrideAllowed" BOOLEAN NOT NULL DEFAULT false,
    "userMayOverride" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_routing_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_profiles" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PROJECT',
    "projectId" TEXT,
    "masterScriptId" TEXT,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "engineKey" TEXT NOT NULL,
    "externalVoiceId" TEXT,
    "gender" TEXT,
    "ageRange" TEXT,
    "nationality" TEXT,
    "nativeLanguage" TEXT,
    "spokenLanguages" JSONB,
    "accent" TEXT,
    "style" TEXT,
    "defaultRate" DECIMAL(65,30) DEFAULT 1,
    "defaultPitch" DECIMAL(65,30) DEFAULT 1,
    "emotionalRange" JSONB,
    "clonedFromTalentId" TEXT,
    "sampleUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_voice_assignments" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT,
    "masterScriptId" TEXT,
    "characterName" TEXT NOT NULL,
    "voiceProfileId" TEXT,
    "talentId" TEXT,
    "speakCharacterName" BOOLEAN NOT NULL DEFAULT false,
    "overrides" JSONB,
    "languageMap" JSONB,
    "isNarrator" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_voice_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pronunciation_entries" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PROJECT',
    "projectId" TEXT,
    "masterScriptId" TEXT,
    "revisionId" TEXT,
    "term" TEXT NOT NULL,
    "alias" TEXT,
    "ipa" TEXT,
    "ssmlPhoneme" TEXT,
    "locale" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pronunciation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_render_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "scriptId" TEXT,
    "revisionId" TEXT NOT NULL,
    "profileId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'TABLE_READ',
    "selection" JSONB,
    "engineKey" TEXT,
    "format" TEXT NOT NULL DEFAULT 'MP3',
    "options" JSONB,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "costEstimate" DECIMAL(65,30),
    "costActual" DECIMAL(65,30),
    "currency" TEXT DEFAULT 'USD',
    "charsBilled" INTEGER,
    "durationSec" INTEGER,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "error" TEXT,
    "outputAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "audio_render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "scriptId" TEXT,
    "revisionId" TEXT,
    "scriptVersionLabel" TEXT,
    "jobId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'FULL_MIX',
    "characterName" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT,
    "durationSec" INTEGER,
    "fileSizeBytes" BIGINT,
    "checksum" TEXT,
    "voiceConfigSnapshot" JSONB,
    "exportConfigSnapshot" JSONB,
    "engineKey" TEXT,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "storageTier" TEXT NOT NULL DEFAULT 'HOT',

    CONSTRAINT "audio_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_usage_records" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "engineKey" TEXT NOT NULL,
    "capability" TEXT NOT NULL DEFAULT 'TTS',
    "projectId" TEXT,
    "userId" TEXT,
    "charsBilled" INTEGER NOT NULL DEFAULT 0,
    "seconds" DECIMAL(65,30),
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30) DEFAULT 0,
    "currency" TEXT DEFAULT 'USD',
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_quotas" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PROJECT',
    "projectId" TEXT,
    "userId" TEXT,
    "period" TEXT NOT NULL DEFAULT 'MONTH',
    "charLimit" INTEGER,
    "secondLimit" INTEGER,
    "costLimit" DECIMAL(65,30),
    "storageQuotaBytes" BIGINT,
    "usedChars" INTEGER NOT NULL DEFAULT 0,
    "usedSeconds" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usedStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "resetsAt" TIMESTAMP(3),
    "hardStop" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_synthesis_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "engineKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationMs" INTEGER,
    "charsBilled" INTEGER NOT NULL DEFAULT 0,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_synthesis_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_layer_assets" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PROJECT',
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationMs" INTEGER,
    "tags" JSONB,
    "source" TEXT NOT NULL DEFAULT 'LIBRARY',
    "engineKey" TEXT,
    "genPrompt" TEXT,
    "genParams" JSONB,
    "license" JSONB,
    "loopable" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_layer_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_audio_cues" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "sceneNumber" TEXT,
    "layerType" TEXT NOT NULL,
    "layerAssetId" TEXT,
    "uploadUrl" TEXT,
    "genPrompt" TEXT,
    "startMs" INTEGER NOT NULL DEFAULT 0,
    "endMs" INTEGER,
    "anchorSeg" INTEGER,
    "anchorOffsetMs" INTEGER NOT NULL DEFAULT 0,
    "volumeDb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fadeInMs" INTEGER NOT NULL DEFAULT 0,
    "fadeOutMs" INTEGER NOT NULL DEFAULT 0,
    "duckDialogue" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "confidence" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_audio_cues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_share_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT,
    "note" TEXT,
    "passcode" TEXT,
    "allowDownload" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "maxViews" INTEGER,
    "views" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_revisions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionLabel" TEXT NOT NULL,
    "colorCode" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "pageText" JSONB,
    "lineDirections" JSONB,
    "uploadedById" TEXT,
    "revisionColor" TEXT,
    "revisionRound" INTEGER NOT NULL DEFAULT 0,
    "revisionDate" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_bookmarks" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "sceneNumber" TEXT,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "color" TEXT DEFAULT '#0ea5e9',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_categories" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0ea5e9',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "breakdownCategory" TEXT,
    "budgetCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_scenes" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "projectId" TEXT,
    "sceneNumber" TEXT,
    "slugline" TEXT,
    "intExt" TEXT,
    "dayNight" TEXT,
    "pageStart" INTEGER NOT NULL DEFAULT 1,
    "pageEnd" INTEGER NOT NULL DEFAULT 1,
    "charStart" INTEGER,
    "productionStripId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "storyDay" TEXT,
    "tagNote" TEXT,
    "setName" TEXT,
    "locationId" TEXT,
    "pages" DECIMAL(6,3),
    "estMinutes" INTEGER,
    "breakdownStatus" TEXT,
    "brokenDownAt" TIMESTAMP(3),
    "revisionMark" BOOLEAN NOT NULL DEFAULT false,
    "pageLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_coverage" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "slate" TEXT,
    "cameraSetup" TEXT,
    "description" TEXT,
    "lineCoordinates" JSONB,
    "isOffScreen" BOOLEAN NOT NULL DEFAULT false,
    "cameras" JSONB,
    "slateFormat" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "take_logs" (
    "id" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "takeNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "isCircleTake" BOOLEAN NOT NULL DEFAULT false,
    "inAt" TEXT,
    "outAt" TEXT,
    "wrapTimestamp" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "take_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hot_cost_accruals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shootDate" TIMESTAMP(3),
    "dayNumber" INTEGER,
    "callTime" TEXT,
    "targetWrap" TEXT,
    "actualWrap" TEXT,
    "otMinutes" INTEGER NOT NULL DEFAULT 0,
    "crewCount" INTEGER NOT NULL DEFAULT 0,
    "baseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mealPenaltyAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "forcedCallCount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "status" TEXT NOT NULL DEFAULT 'ESTIMATE',
    "pushedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hot_cost_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotation_layers" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PERSONAL',
    "department" TEXT,
    "color" TEXT NOT NULL DEFAULT '#eab308',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotation_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sides_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "shootDate" TIMESTAMP(3),
    "scenes" JSONB NOT NULL,
    "recipients" JSONB NOT NULL,
    "baseUrl" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sides_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layer_shares" (
    "id" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "templateKey" TEXT,
    "department" TEXT,
    "access" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "layer_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "tool" TEXT NOT NULL DEFAULT 'HIGHLIGHT',
    "payload" JSONB,
    "anchorText" TEXT,
    "anchorHash" TEXT,
    "anchorOffset" INTEGER,
    "surroundingContext" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "w" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "associatedLineItemId" TEXT,
    "conflict" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breakdown_elements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stripId" TEXT,
    "category" "BreakdownCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "costCenterCode" TEXT,
    "costCenterTitle" TEXT,
    "estCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sceneId" TEXT,
    "source" TEXT DEFAULT 'AI',
    "revisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breakdown_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_sync_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revisionId" TEXT,
    "action" TEXT NOT NULL DEFAULT 'SYNC',
    "diff" JSONB,
    "appliedById" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_briefs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "sourceText" TEXT,
    "sourceDocUrl" TEXT,
    "sourceFiles" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RAW',
    "objective" TEXT,
    "keyMessage" TEXT,
    "audience" TEXT,
    "tone" TEXT,
    "mandatories" JSONB,
    "durations" JSONB,
    "aspectRatios" JSONB,
    "channels" JSONB,
    "budgetTier" TEXT,
    "references" JSONB,
    "treatmentDraft" TEXT,
    "scriptDraft" TEXT,
    "extracted" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverables" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationSec" INTEGER,
    "aspectRatio" TEXT,
    "parentId" TEXT,
    "pipelineStatus" TEXT NOT NULL DEFAULT 'PLANNED',
    "dueDate" TIMESTAMP(3),
    "spec" JSONB,
    "channel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_rights" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TALENT',
    "title" TEXT NOT NULL,
    "deliverableId" TEXT,
    "territory" TEXT,
    "media" TEXT,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "exclusivity" BOOLEAN NOT NULL DEFAULT false,
    "fee" DECIMAL(14,2),
    "sessionFee" DECIMAL(14,2),
    "holdingFeeEveryWeeks" INTEGER,
    "holdingFeeAmount" DECIMAL(14,2),
    "nextHoldingFeeAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppm_checklists" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "items" JSONB,
    "agencyApproved" BOOLEAN NOT NULL DEFAULT false,
    "clientApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ppm_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_transactions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectTxnKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountCode" TEXT,
    "accountTitle" TEXT,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "party" TEXT,
    "reference" TEXT,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "status" "ProjectTxnStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "invoiceNumber" TEXT,
    "vendorId" TEXT,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(15,2),
    "paidById" TEXT,
    "approvedById" TEXT,
    "journalEntryId" TEXT,
    "invoiceClassification" "InvoiceClassification",
    "zatcaUuid" TEXT,
    "zatcaIcv" INTEGER,
    "zatcaXmlHash" TEXT,
    "zatcaPreviousInvoiceHash" TEXT,
    "zatcaCryptographicStamp" TEXT,
    "zatcaCsid" TEXT,
    "zatcaQrCode" TEXT,
    "zatcaClearanceStatus" TEXT,
    "zatcaClearedAt" TIMESTAMP(3),
    "jordanFawateeryUuid" TEXT,
    "jordanFawateeryQR" TEXT,
    "ublStandardVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_payroll_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT,
    "weekEnding" TIMESTAMP(3),
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "grossTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fringeTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "timecardCount" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_bank_recons" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT,
    "statementDate" TIMESTAMP(3),
    "statementBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "clearedTxnIds" JSONB,
    "status" "BankReconStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_bank_recons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_production_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "callSheetId" TEXT,
    "dayNumber" INTEGER NOT NULL DEFAULT 1,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "unitName" TEXT,
    "status" "DprStatus" NOT NULL DEFAULT 'DRAFT',
    "crewCall" TEXT,
    "firstShot" TEXT,
    "lunchOut" TEXT,
    "lunchIn" TEXT,
    "lastShot" TEXT,
    "unitWrap" TEXT,
    "scenesScheduled" DECIMAL(8,2),
    "scenesShot" DECIMAL(8,2),
    "pagesScheduled" DECIMAL(8,2),
    "pagesShot" DECIMAL(8,2),
    "setupsPlanned" INTEGER,
    "setupsActual" INTEGER,
    "scheduleDayVariance" DECIMAL(6,2),
    "weather" TEXT,
    "locationName" TEXT,
    "scenesCompleted" JSONB,
    "castDays" JSONB,
    "incidents" JSONB,
    "hotCosts" JSONB,
    "otHours" DECIMAL(8,2),
    "mealPenalties" INTEGER,
    "estimatedDayCost" DECIMAL(14,2),
    "notes" TEXT,
    "preparedBy" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_production_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_advances" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "holderId" TEXT,
    "purpose" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "clearedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "returnedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "costCenterCode" TEXT,
    "costCenterTitle" TEXT,
    "dateIssued" TIMESTAMP(3),
    "status" "CashAdvanceStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_transactions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cardLast4" TEXT,
    "cardholderName" TEXT,
    "merchant" TEXT,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "txnDate" TIMESTAMP(3),
    "costCenterCode" TEXT,
    "costCenterTitle" TEXT,
    "statementRef" TEXT,
    "status" "CardTxnStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "postedTxnId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claims" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantId" TEXT,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "costCenterCode" TEXT,
    "costCenterTitle" TEXT,
    "dateSubmitted" TIMESTAMP(3),
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reimbursedTxnId" TEXT,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prNumber" TEXT NOT NULL,
    "description" TEXT,
    "costCenterCode" TEXT,
    "costCenterTitle" TEXT,
    "budgetLineItemId" TEXT,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "neededBy" TIMESTAMP(3),
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "poId" TEXT,
    "notes" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_vendors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "trn" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_vendors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "PendingVendorStatus" NOT NULL DEFAULT 'PENDING',
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "category" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'United Arab Emirates',
    "trn" TEXT,
    "vatId" TEXT,
    "iban" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "swiftCode" TEXT,
    "trnCertUrl" TEXT,
    "tradeLicenseUrl" TEXT,
    "notes" TEXT,
    "submittedIp" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "productionVendorId" TEXT,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "costCenterCode" TEXT,
    "costCenterTitle" TEXT,
    "budgetLineItemId" TEXT,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "invoicedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT,
    "invoiceClassification" "InvoiceClassification",
    "zatcaUuid" TEXT,
    "zatcaIcv" INTEGER,
    "zatcaXmlHash" TEXT,
    "zatcaPreviousInvoiceHash" TEXT,
    "zatcaCryptographicStamp" TEXT,
    "zatcaCsid" TEXT,
    "zatcaQrCode" TEXT,
    "zatcaClearanceStatus" TEXT,
    "zatcaClearedAt" TIMESTAMP(3),
    "jordanFawateeryUuid" TEXT,
    "jordanFawateeryQR" TEXT,
    "ublStandardVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_report_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT,
    "data" JSONB NOT NULL,
    "budget" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "committed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "actual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "efc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "variance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_floats" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "openingAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petty_cash_floats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_txns" (
    "id" TEXT NOT NULL,
    "floatId" TEXT NOT NULL,
    "type" "PettyCashTxnType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "costCenterCode" TEXT,
    "costCenterTitle" TEXT,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ledgerTxnId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petty_cash_txns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_rolls" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "blocks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_rolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "accountCode" TEXT,
    "accountTitle" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" "OverageStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_transfers" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromCode" TEXT NOT NULL,
    "fromTitle" TEXT,
    "toCode" TEXT NOT NULL,
    "toTitle" TEXT,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "per_diems" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "crewName" TEXT NOT NULL,
    "location" TEXT,
    "ratePerDay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "days" INTEGER NOT NULL DEFAULT 1,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "PerDiemStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "per_diems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_sheets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL DEFAULT 1,
    "totalDays" INTEGER,
    "shootDate" TIMESTAMP(3) NOT NULL,
    "status" "CallSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "generalCall" TEXT,
    "shootingCall" TEXT,
    "estWrap" TEXT,
    "weather" TEXT,
    "tempHigh" TEXT,
    "tempLow" TEXT,
    "sunrise" TEXT,
    "sunset" TEXT,
    "goldenHourAm" TEXT,
    "goldenHourPm" TEXT,
    "locationId" TEXT,
    "locationName" TEXT,
    "locationAddress" TEXT,
    "locationMapUrl" TEXT,
    "parkingNotes" TEXT,
    "basecampNotes" TEXT,
    "hospitalName" TEXT,
    "hospitalAddress" TEXT,
    "hospitalPhone" TEXT,
    "keyContacts" JSONB,
    "scheduleItems" JSONB,
    "castCalls" JSONB,
    "backgroundCalls" JSONB,
    "crewCalls" JSONB,
    "advanceSchedule" JSONB,
    "notes" TEXT,
    "safetyNotes" TEXT,
    "extra" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "unitCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "location" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "StockMoveType" NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unitCost" DECIMAL(15,2),
    "reference" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "balanceAfter" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GlAccountType" NOT NULL,
    "subtype" TEXT,
    "description" TEXT,
    "isBank" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "reference" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "glAccountId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementBalance" DECIMAL(15,2) NOT NULL,
    "clearedBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "status" "BudgetVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lockedAt" TIMESTAMP(3),
    "versionSequence" INTEGER NOT NULL DEFAULT 0,
    "parentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lifecycle_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetVersionId" TEXT NOT NULL,
    "fromStatus" "BudgetVersionStatus" NOT NULL,
    "toStatus" "BudgetVersionStatus" NOT NULL,
    "versionNameSnap" TEXT NOT NULL,
    "changedById" TEXT,
    "changedByRole" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_lifecycle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_globals" (
    "id" TEXT NOT NULL,
    "budgetVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DECIMAL(10,3) NOT NULL,
    "unit" TEXT,

    CONSTRAINT "budget_globals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fringe_profiles" (
    "id" TEXT NOT NULL,
    "budgetVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "fringe_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_sections" (
    "id" TEXT NOT NULL,
    "budgetVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,

    CONSTRAINT "budget_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_accounts" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "etcAmount" DECIMAL(15,2),

    CONSTRAINT "budget_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_line_items" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT,
    "subTitle" TEXT,
    "description" TEXT NOT NULL,
    "quantityFormula" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "units" TEXT,
    "rate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "fringeProfileId" TEXT,
    "fringePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "classificationCode" TEXT,
    "fringeDetail" JSONB,
    "castTalentId" TEXT,
    "crewMemberId" TEXT,
    "stages" JSONB,
    "origin" "LineItemOrigin" NOT NULL DEFAULT 'MANUAL',
    "aiSuggestedRate" DECIMAL(15,2),
    "aiSuggestedQuantity" DECIMAL(10,3),
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fringeAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "sourceAnnotationId" TEXT,

    CONSTRAINT "budget_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_crew" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ProductionCrewRole" NOT NULL DEFAULT 'OTHER',
    "department" TEXT,
    "roleTitle" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "costTreatment" TEXT NOT NULL DEFAULT 'PROJECT_HIRE',
    "productionVehicle" BOOLEAN NOT NULL DEFAULT false,
    "driverLicenseNumber" TEXT,
    "driverLicenseExpiry" TIMESTAMP(3),
    "driverLicenseDocUrl" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "crewMemberId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "dailyRate" DECIMAL(10,2),
    "weeklyRate" DECIMAL(10,2),
    "totalDays" INTEGER,
    "totalPaid" DECIMAL(10,2),
    "notes" TEXT,
    "dealMemoStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
    "ndaStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "dealMemoUrl" TEXT,
    "contractUrl" TEXT,
    "idShareConsent" BOOLEAN NOT NULL DEFAULT false,
    "idShareConsentAt" TIMESTAMP(3),
    "passportUrl" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "emiratesIdUrl" TEXT,
    "emiratesIdExpiry" TIMESTAMP(3),
    "idPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_schedules" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "callTime" TEXT,
    "wrapTime" TEXT,
    "scenes" TEXT,
    "notes" TEXT,

    CONSTRAINT "production_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorType" "VendorType" NOT NULL DEFAULT 'AUTO_WORKSHOP',
    "secondaryType" "VendorType",
    "contactPerson" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "googleMapsUrl" TEXT,
    "gpsCoordinates" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trn" TEXT,
    "tradeLicenseNumber" TEXT,
    "tradeLicenseExpiry" TIMESTAMP(3),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "iban" TEXT,
    "swiftCode" TEXT,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_documents" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "docType" "VendorDocType" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_maintenance_jobs" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "assetId" TEXT,
    "status" "VendorJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "VendorJobPriority" NOT NULL DEFAULT 'NORMAL',
    "category" TEXT,
    "problemDescription" TEXT NOT NULL,
    "internalNotes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimatedCompletion" TIMESTAMP(3),
    "actualCompletion" TIMESTAMP(3),
    "currentOdometer" INTEGER,
    "currentHours" DECIMAL(10,2),
    "assetLocation" TEXT,
    "laborCost" DECIMAL(15,2),
    "partsCost" DECIMAL(15,2),
    "subtotal" DECIMAL(15,2),
    "vatAmount" DECIMAL(15,2),
    "totalCost" DECIMAL(15,2),
    "photos" TEXT[],
    "attachmentUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_maintenance_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spare_parts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "manufacturer" TEXT,
    "vendorId" TEXT,
    "assetId" TEXT,
    "jobId" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(12,2),
    "vatAmount" DECIMAL(12,2),
    "invoiceUrl" TEXT,
    "installationDate" TIMESTAMP(3),
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "expectedLifespanYears" DECIMAL(5,2),
    "expectedLifespanKm" INTEGER,
    "expectedLifespanHours" INTEGER,
    "condition" TEXT DEFAULT 'NEW',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spare_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tire_records" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "vendorId" TEXT,
    "jobId" TEXT,
    "position" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "size" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "installationDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(12,2),
    "invoiceUrl" TEXT,
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "expectedLifespanKm" INTEGER,
    "expectedLifespanYears" DECIMAL(5,2),
    "odometerAtInstall" INTEGER,
    "currentOdometer" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tire_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "laborCost" DECIMAL(15,2),
    "partsCost" DECIMAL(15,2),
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vendorRef" TEXT,
    "docUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "jobId" TEXT,
    "quotationId" TEXT,
    "status" "VendorInvoiceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "laborCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "partsCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vendorInvoiceRef" TEXT,
    "docUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payments" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "status" "VendorPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactType" "ContactType" NOT NULL DEFAULT 'OTHER',
    "jobTitle" TEXT,
    "department" TEXT,
    "company" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "landline" TEXT,
    "email" TEXT,
    "clientId" TEXT,
    "vendorId" TEXT,
    "supplierId" TEXT,
    "driverId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL DEFAULT 'The Film Makers FZ LLC',
    "tradeName" TEXT,
    "trn" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'UAE',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'AED',
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "defaultPaymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "quotationPrefix" TEXT NOT NULL DEFAULT 'QT',
    "bookingPrefix" TEXT NOT NULL DEFAULT 'RB',
    "defaultBankName" TEXT,
    "defaultBankAccount" TEXT,
    "defaultBankIban" TEXT,
    "defaultBankSwift" TEXT,
    "defaultBankBranch" TEXT,
    "defaultBankAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_logs" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordRef" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "logoUrl" TEXT,
    "darkLogoUrl" TEXT,
    "stampUrl" TEXT,
    "registrationNumber" TEXT,
    "trn" TEXT,
    "corporateTaxNumber" TEXT,
    "poBox" TEXT,
    "website" TEXT,
    "mainEmail" TEXT,
    "billingEmail" TEXT,
    "mainPhone" TEXT,
    "emergencyPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "emirate" TEXT,
    "country" TEXT DEFAULT 'United Arab Emirates',
    "timeZone" TEXT DEFAULT 'Asia/Dubai',
    "currency" TEXT DEFAULT 'AED',
    "language" TEXT DEFAULT 'English',
    "classification" TEXT DEFAULT 'Mainland',
    "licensingAuthority" TEXT,
    "licenseType" TEXT,
    "businessActivity" TEXT,
    "tradeLicenseNumber" TEXT,
    "licenseIssueDate" TIMESTAMP(3),
    "licenseExpiryDate" TIMESTAMP(3),
    "licenseStatus" TEXT DEFAULT 'Active',
    "mohreEstablishmentNumber" TEXT,
    "labourFileNumber" TEXT,
    "immigrationEstablishmentNumber" TEXT,
    "chamberOfCommerceNumber" TEXT,
    "economicDeptRegistration" TEXT,
    "freeZoneAuthority" TEXT,
    "freeZoneRegistrationNumber" TEXT,
    "establishmentCardNumber" TEXT,
    "immigrationFileNumber" TEXT,
    "vatStatus" TEXT DEFAULT 'Registered',
    "vatRegistrationDate" TIMESTAMP(3),
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "corporateTaxStatus" TEXT DEFAULT 'Registered',
    "corporateTaxRegistrationDate" TIMESTAMP(3),
    "defaultCorporateTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 9,
    "invoiceLogoUrl" TEXT,
    "watermarkUrl" TEXT,
    "emailSignature" TEXT,
    "brandPrimaryColor" TEXT DEFAULT '#0f172a',
    "brandSecondaryColor" TEXT DEFAULT '#c3a56e',
    "brandAccentColor" TEXT DEFAULT '#2563eb',
    "invoicePrefix" TEXT DEFAULT 'INV',
    "quotationPrefix" TEXT DEFAULT 'QT',
    "bookingPrefix" TEXT DEFAULT 'RB',
    "receiptPrefix" TEXT DEFAULT 'RCP',
    "defaultPaymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "dateFormat" TEXT DEFAULT 'DD/MM/YYYY',
    "documentSettings" JSONB,
    "emailSettings" JSONB,
    "setupComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_bank_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branch" TEXT,
    "accountNumber" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "currency" TEXT DEFAULT 'AED',
    "bankAddress" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_locations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT DEFAULT 'Head Office',
    "address" TEXT,
    "googleMapsUrl" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "contactNumber" TEXT,
    "manager" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "fileUrl" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "maritalStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "personalEmail" TEXT,
    "homeAddress" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactNumber" TEXT,
    "emergencyContactRelationship" TEXT,
    "department" TEXT,
    "position" TEXT,
    "jobTitle" TEXT,
    "grade" TEXT,
    "employmentType" TEXT DEFAULT 'FullTime',
    "joiningDate" TIMESTAMP(3),
    "probationStart" TIMESTAMP(3),
    "probationEnd" TIMESTAMP(3),
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "resignationDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "reportingManagerId" TEXT,
    "workLocation" TEXT,
    "labourCardNumber" TEXT,
    "workPermitNumber" TEXT,
    "workPermitIssueDate" TIMESTAMP(3),
    "workPermitExpiryDate" TIMESTAMP(3),
    "labourCardStatus" TEXT,
    "employmentCardNumber" TEXT,
    "employmentCardIssueDate" TIMESTAMP(3),
    "employmentCardExpiryDate" TIMESTAMP(3),
    "employmentPermitInfo" TEXT,
    "emiratesId" TEXT,
    "emiratesIdExpiry" TIMESTAMP(3),
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "visaNumber" TEXT,
    "visaExpiry" TIMESTAMP(3),
    "payStructure" TEXT DEFAULT 'Monthly',
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "housingAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transportAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "foodAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mobileAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fuelAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "iban" TEXT,
    "accountNumber" TEXT,
    "swift" TEXT,
    "isDriver" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Annual',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Present',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "driverType" TEXT DEFAULT 'EmployeeDriver',
    "licenseNumber" TEXT,
    "licenseCategory" TEXT,
    "licenseIssueDate" TIMESTAMP(3),
    "licenseExpiryDate" TIMESTAMP(3),
    "driverStatus" TEXT DEFAULT 'Available',
    "rating" DOUBLE PRECISION,
    "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tripRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" TEXT,
    "assignmentDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Assigned',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingBody" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_plans" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "intervalKm" INTEGER,
    "intervalHours" INTEGER,
    "lastServiceDate" TIMESTAMP(3),
    "lastServiceOdometer" INTEGER,
    "lastServiceHours" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_reports" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "assetId" TEXT,
    "type" TEXT NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedBy" TEXT,
    "odometer" INTEGER,
    "fuelLevel" TEXT,
    "checklist" JSONB,
    "damageNotes" TEXT,
    "photos" TEXT[],
    "signatureName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condition_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "module" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT,
    "level" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "to" TEXT,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "estimatedValue" DECIMAL(15,2),
    "ownerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'QUALIFIED',
    "value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 50,
    "expectedCloseDate" TIMESTAMP(3),
    "source" TEXT,
    "ownerId" TEXT,
    "quotationId" TEXT,
    "lostReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "role" TEXT,
    "nationality" TEXT,
    "baseCountry" TEXT,
    "baseEmirate" TEXT,
    "isLocal" BOOLEAN NOT NULL DEFAULT true,
    "bio" TEXT,
    "reelUrl" TEXT,
    "resumeUrl" TEXT,
    "skills" TEXT,
    "links" JSONB,
    "credits" JSONB,
    "categories" JSONB,
    "affiliations" JSONB,
    "email" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "photoUrl" TEXT,
    "dayRateUsd" DECIMAL(12,2),
    "dayRateAed" DECIMAL(12,2),
    "weeklyRateUsd" DECIMAL(12,2),
    "weeklyRateAed" DECIMAL(12,2),
    "prepWrapDayRateUsd" DECIMAL(12,2),
    "prepWrapDayRateAed" DECIMAL(12,2),
    "prepWrapWeeklyRateUsd" DECIMAL(12,2),
    "prepWrapWeeklyRateAed" DECIMAL(12,2),
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "visaNumber" TEXT,
    "visaExpiry" TIMESTAMP(3),
    "emiratesId" TEXT,
    "emiratesIdExpiry" TIMESTAMP(3),
    "passportDocUrl" TEXT,
    "visaDocUrl" TEXT,
    "emiratesIdDocUrl" TEXT,
    "ibanDocUrl" TEXT,
    "bankName" TEXT,
    "bankAddress" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "swiftCode" TEXT,
    "routingNumber" TEXT,
    "iban" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "parentSystemUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_locations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "siteName" TEXT,
    "address" TEXT,
    "locationUrl" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "crewCount" INTEGER,
    "arrivedAt" TIMESTAMP(3),
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_submissions" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "driverJobId" TEXT,
    "bookingId" TEXT,
    "assetId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "litres" DECIMAL(8,2),
    "odometer" INTEGER,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductionNotes" TEXT,
    "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankName" TEXT,
    "iban" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_nodes" (
    "id" TEXT NOT NULL,
    "level" "GeoLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurisdiction_tax_rules" (
    "id" TEXT NOT NULL,
    "geoNodeId" TEXT NOT NULL,
    "taxKind" TEXT NOT NULL DEFAULT 'VAT',
    "name" TEXT NOT NULL,
    "ratePct" DECIMAL(7,4) NOT NULL,
    "recoverable" BOOLEAN NOT NULL DEFAULT true,
    "recoveryPct" DECIMAL(7,4),
    "rules" JSONB,
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurisdiction_tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_bodies" (
    "id" TEXT NOT NULL,
    "kind" "LaborBodyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "countryId" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_bodies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" TEXT NOT NULL,
    "laborBodyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productionTypes" JSONB NOT NULL,
    "tier" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "status" "AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classifications" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "riskClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_rules" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "classificationId" TEXT,
    "label" TEXT NOT NULL,
    "rateType" "RateType" NOT NULL,
    "calcMethod" "CalcMethod" NOT NULL,
    "value" DECIMAL(12,5) NOT NULL,
    "base" "RateBase",
    "capPeriod" "CapPeriod",
    "capAmount" DECIMAL(14,2),
    "floorAmount" DECIMAL(14,2),
    "tiers" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "glAccountCode" TEXT,
    "sourceId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "previousId" TEXT,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_sources" (
    "id" TEXT NOT NULL,
    "laborBodyId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "publisher" TEXT,
    "trusted" BOOLEAN NOT NULL DEFAULT true,
    "retrievedAt" TIMESTAMP(3),
    "lastHash" TEXT,
    "lastStatus" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_change_proposals" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "diff" JSONB,
    "sourceId" TEXT,
    "confidence" DECIMAL(5,2),
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_change_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_labor_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "geoNodeId" TEXT,
    "productionType" TEXT NOT NULL,
    "unionStatus" "UnionStatus" NOT NULL DEFAULT 'NON_UNION',
    "laborBodyIds" JSONB NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "snapshotAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_labor_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_rate_rules" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceRuleId" TEXT,
    "laborBodyName" TEXT NOT NULL,
    "agreementName" TEXT NOT NULL,
    "classificationCode" TEXT,
    "label" TEXT NOT NULL,
    "rateType" "RateType" NOT NULL,
    "calcMethod" "CalcMethod" NOT NULL,
    "value" DECIMAL(12,5) NOT NULL,
    "base" "RateBase",
    "capPeriod" "CapPeriod",
    "capAmount" DECIMAL(14,2),
    "floorAmount" DECIMAL(14,2),
    "tiers" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "glAccountCode" TEXT,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_rate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_programs" (
    "id" TEXT NOT NULL,
    "geoNodeId" TEXT,
    "name" TEXT NOT NULL,
    "authority" TEXT,
    "incentiveType" "IncentiveType" NOT NULL DEFAULT 'TAX_CREDIT',
    "ratePct" DECIMAL(6,4) NOT NULL,
    "basis" TEXT NOT NULL DEFAULT 'QUALIFIED',
    "minSpend" DECIMAL(15,2),
    "capAmount" DECIMAL(15,2),
    "upliftPct" DECIMAL(6,4),
    "transferable" BOOLEAN NOT NULL DEFAULT false,
    "refundable" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "productionTypes" JSONB,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "isEstimate" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "complianceRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incentive_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_claims" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "programName" TEXT NOT NULL DEFAULT 'Abu Dhabi Film Rebate',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "standardPct" DECIMAL(6,4) NOT NULL DEFAULT 0.35,
    "criteria" JSONB,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "enhancedPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "totalPct" DECIMAL(6,4) NOT NULL DEFAULT 0.35,
    "adqpe" DECIMAL(15,2),
    "capAmount" DECIMAL(15,2),
    "estimatedRebate" DECIMAL(15,2),
    "stages" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incentive_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_incentives" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "programId" TEXT,
    "name" TEXT NOT NULL,
    "incentiveType" "IncentiveType" NOT NULL DEFAULT 'TAX_CREDIT',
    "ratePct" DECIMAL(6,4) NOT NULL,
    "basis" TEXT NOT NULL DEFAULT 'QUALIFIED',
    "capAmount" DECIMAL(15,2),
    "minSpend" DECIMAL(15,2),
    "upliftPct" DECIMAL(6,4),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "qualifiedSpendOverride" DECIMAL(15,2),
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_incentives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" "WorkflowEntity" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverTemplateKey" TEXT,
    "approverRole" TEXT,
    "slaHours" INTEGER,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityType" "WorkflowEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "label" TEXT,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "currentOrder" INTEGER NOT NULL DEFAULT 1,
    "startedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "nodeOrder" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "delegateToId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traveler_profiles" (
    "id" TEXT NOT NULL,
    "personType" "TravelerPersonType" NOT NULL DEFAULT 'TALENT',
    "fullName" TEXT NOT NULL,
    "legalName" TEXT,
    "preferredName" TEXT,
    "gender" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "nationality" TEXT,
    "countryOfResidence" TEXT,
    "passportNumber" TEXT,
    "passportPlaceOfIssue" TEXT,
    "passportIssueDate" TIMESTAMP(3),
    "passportExpiry" TIMESTAMP(3),
    "dateOfBirth" TIMESTAMP(3),
    "nationalId" TEXT,
    "headshotUrl" TEXT,
    "passportPhotoUrl" TEXT,
    "additionalIdPhotoUrl" TEXT,
    "passportFrontUrl" TEXT,
    "passportInfoUrl" TEXT,
    "passportAdditionalUrl" TEXT,
    "passportPdfUrl" TEXT,
    "travelPrefs" JSONB,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "homeCountry" TEXT,
    "homeCity" TEXT,
    "workRegion" TEXT,
    "isLocalTalent" BOOLEAN NOT NULL DEFAULT false,
    "travelRequired" BOOLEAN NOT NULL DEFAULT false,
    "visaRequired" BOOLEAN NOT NULL DEFAULT false,
    "accommodationRequired" BOOLEAN NOT NULL DEFAULT false,
    "groundTransportRequired" BOOLEAN NOT NULL DEFAULT false,
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "notes" TEXT,
    "crewMemberId" TEXT,
    "talentProfileId" TEXT,
    "accompaniesId" TEXT,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traveler_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traveler_visas" (
    "id" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "visaType" TEXT,
    "country" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "entriesAllowed" TEXT,
    "sponsor" TEXT,
    "status" "TravelerVisaStatus" NOT NULL DEFAULT 'REQUIRED',
    "visaCopyUrl" TEXT,
    "evisaPdfUrl" TEXT,
    "entryPermitUrl" TEXT,
    "residencePermitUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traveler_visas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traveler_documents" (
    "id" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "type" "TravelerDocType" NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traveler_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_arrivals" (
    "id" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "tripId" TEXT,
    "projectId" TEXT,
    "airport" TEXT,
    "flightNumber" TEXT,
    "arrivalTime" TIMESTAMP(3),
    "terminal" TEXT,
    "driverAssigned" TEXT,
    "coordinatorAssigned" TEXT,
    "notes" TEXT,
    "status" "ArrivalStatus" NOT NULL DEFAULT 'SCHEDULED',
    "vehicleId" TEXT,
    "transportDriverId" TEXT,
    "meetGreetRep" TEXT,
    "arrivalPhotoUrl" TEXT,
    "landedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_arrivals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "travelerId" TEXT NOT NULL,
    "purpose" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "destinationGeoNodeId" TEXT,
    "departDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "estimatedCost" DECIMAL(14,2),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "status" "TripStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itineraries" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "totalCost" DECIMAL(14,2),
    "status" "TravelBookingStatus" NOT NULL DEFAULT 'DRAFT',
    "purchaseOrderId" TEXT,
    "postedTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_bookings" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "carrier" TEXT,
    "flightNumber" TEXT,
    "departAirport" TEXT,
    "arriveAirport" TEXT,
    "departureTime" TIMESTAMP(3),
    "arrivalTime" TIMESTAMP(3),
    "cabinClass" TEXT,
    "fare" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "pnr" TEXT,
    "status" "TravelBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flight_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_bookings" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "hotelName" TEXT,
    "roomType" TEXT,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "nightlyRate" DECIMAL(12,2),
    "totalRate" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "confirmationNumber" TEXT,
    "status" "TravelBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_bookings" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "vendor" TEXT,
    "carType" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "rate" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "confirmationNumber" TEXT,
    "status" "TravelBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "car_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_applications" (
    "id" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "tripId" TEXT,
    "country" TEXT NOT NULL,
    "destinationGeoNodeId" TEXT,
    "visaType" "VisaType" NOT NULL DEFAULT 'OTHER',
    "status" "VisaStatus" NOT NULL DEFAULT 'REQUIRED',
    "slaDays" INTEGER,
    "requiredDocuments" JSONB,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "expectedDecisionAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "expiryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TravelSupplierType" NOT NULL DEFAULT 'OTHER',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContractType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bodyMarkdown" TEXT NOT NULL,
    "variables" JSONB,
    "governingLaw" TEXT,
    "jurisdiction" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "bodyMarkdown" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "riskLevel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clause_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContractType" NOT NULL DEFAULT 'OTHER',
    "status" "ProjectContractStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "projectId" TEXT,
    "templateId" TEXT,
    "budgetLineItemId" TEXT,
    "productionCrewId" TEXT,
    "bodyMarkdown" TEXT,
    "resolvedVars" JSONB,
    "rateSnapshotId" TEXT,
    "dailyRate" DECIMAL(14,2),
    "contractValue" DECIMAL(16,2),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "esignProvider" TEXT,
    "esignEnvelopeId" TEXT,
    "purchaseOrderId" TEXT,
    "workflowInstanceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_parties" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "role" "ContractPartyRole" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "organization" TEXT,
    "title" TEXT,
    "signerOrder" INTEGER NOT NULL DEFAULT 1,
    "signatureStatus" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signatureMethod" "SignatureMethod" NOT NULL DEFAULT 'ESIGN',
    "signedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_audit_logs" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "partyId" TEXT,
    "event" "SignatureEvent" NOT NULL,
    "method" "SignatureMethod",
    "actorName" TEXT,
    "actorEmail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "documentHash" TEXT,
    "providerEventId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_talent_profiles" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "stageName" TEXT,
    "status" "TalentStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" TEXT,
    "phone" TEXT,
    "gender" TEXT,
    "ethnicity" TEXT,
    "nationality" TEXT,
    "baseCity" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "heightCm" INTEGER,
    "physical" JSONB,
    "preferredName" TEXT,
    "nationalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentLocation" TEXT,
    "dialects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weightKg" INTEGER,
    "tattoos" TEXT,
    "distinguishingFeatures" TEXT,
    "biography" TEXT,
    "pressLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whatsapp" TEXT,
    "emergencyContact" JSONB,
    "awards" JSONB,
    "headshotUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reelUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resumeUrl" TEXT,
    "portfolioUrl" TEXT,
    "unions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unionStatus" TEXT,
    "laborBodyId" TEXT,
    "representedById" TEXT,
    "homeCountry" TEXT,
    "homeCity" TEXT,
    "workRegion" TEXT,
    "isLocalTalent" BOOLEAN NOT NULL DEFAULT false,
    "travelRequired" BOOLEAN NOT NULL DEFAULT false,
    "visaRequired" BOOLEAN NOT NULL DEFAULT false,
    "accommodationRequired" BOOLEAN NOT NULL DEFAULT false,
    "groundTransportRequired" BOOLEAN NOT NULL DEFAULT false,
    "agentName" TEXT,
    "agentEmail" TEXT,
    "agencyName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "guardianName" TEXT,
    "guardianEmail" TEXT,
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consentGivenAt" TIMESTAMP(3),
    "consentExpiresAt" TIMESTAMP(3),
    "gdprConsentVersion" TEXT,
    "lawfulBasis" TEXT,
    "dataRetentionUntil" TIMESTAMP(3),
    "erasureRequestedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_talent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casting_calls" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "breakdownElementId" TEXT,
    "characterProfileId" TEXT,
    "roleName" TEXT NOT NULL,
    "roleType" "CastingRoleType" NOT NULL DEFAULT 'SUPPORTING',
    "characterDescription" TEXT,
    "status" "CastingCallStatus" NOT NULL DEFAULT 'DRAFT',
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "gender" TEXT,
    "ethnicity" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unionRequirement" TEXT,
    "rateMin" DECIMAL(14,2),
    "rateMax" DECIMAL(14,2),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "slotsToFill" INTEGER NOT NULL DEFAULT 1,
    "shootDatesNote" TEXT,
    "deadline" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "castingDirectorId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casting_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_profiles" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "breakdownElementId" TEXT,
    "name" TEXT NOT NULL,
    "backstory" TEXT,
    "arc" TEXT,
    "relationships" TEXT,
    "shootDays" INTEGER,
    "locations" TEXT,
    "dialoguePages" DECIMAL(8,1),
    "stuntDays" INTEGER,
    "requirements" TEXT,
    "notes" TEXT,
    "characterCode" TEXT,
    "scriptReference" TEXT,
    "personalityNotes" TEXT,
    "visualReferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scenesCount" INTEGER,
    "nightShoots" INTEGER,
    "travelDays" INTEGER,
    "castingGender" TEXT,
    "ageRangeMin" INTEGER,
    "ageRangeMax" INTEGER,
    "castingEthnicity" TEXT,
    "castingNationality" TEXT,
    "castingLanguage" TEXT,
    "castingAccent" TEXT,
    "physicalRequirements" TEXT,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casting_submissions" (
    "id" TEXT NOT NULL,
    "castingCallId" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "source" "SubmissionSource" NOT NULL DEFAULT 'SELF',
    "boardVerdict" "BoardVerdict",
    "coverNote" TEXT,
    "proposedRate" DECIMAL(14,2),
    "availabilityNote" TEXT,
    "rank" INTEGER,
    "score" INTEGER,
    "reviewedById" TEXT,
    "decisionNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casting_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_ops_checklists" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "wardrobeComplete" BOOLEAN NOT NULL DEFAULT false,
    "measurementsComplete" BOOLEAN NOT NULL DEFAULT false,
    "fittingsComplete" BOOLEAN NOT NULL DEFAULT false,
    "makeupNotesComplete" BOOLEAN NOT NULL DEFAULT false,
    "bankingComplete" BOOLEAN NOT NULL DEFAULT false,
    "taxDocsComplete" BOOLEAN NOT NULL DEFAULT false,
    "vendorSetupComplete" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_ops_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_negotiations" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "status" "NegotiationStatus" NOT NULL DEFAULT 'OPEN',
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "initialOffer" DECIMAL(14,2),
    "counterOffer" DECIMAL(14,2),
    "finalRate" DECIMAL(14,2),
    "travelClass" TEXT,
    "accommodationTier" TEXT,
    "perDiem" DECIMAL(12,2),
    "buyout" TEXT,
    "exclusivity" TEXT,
    "marketingRequirements" TEXT,
    "notes" TEXT,
    "rounds" JSONB,
    "contractId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_negotiations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casting_auditions" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "type" "AuditionType" NOT NULL DEFAULT 'SELF_TAPE',
    "status" "AuditionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "durationMins" INTEGER,
    "location" TEXT,
    "virtualLink" TEXT,
    "selfTapeUrl" TEXT,
    "recordingUrl" TEXT,
    "sides" TEXT,
    "score" INTEGER,
    "ratingBreakdown" JSONB,
    "panelNotes" TEXT,
    "decision" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casting_auditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "method" TEXT,
    "documentUrl" TEXT,
    "ipAddress" TEXT,
    "lawfulBasis" TEXT,
    "version" TEXT,
    "grantedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "guardianName" TEXT,
    "capturedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_performance_reviews" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "projectId" TEXT,
    "department" TEXT,
    "metric" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comments" TEXT,
    "raterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_properties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccommodationType" NOT NULL DEFAULT 'HOTEL',
    "supplierId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'United Arab Emirates',
    "gpsCoordinates" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_inventory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'SINGLE',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "nightlyRate" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_assignments" (
    "id" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "propertyId" TEXT,
    "roomId" TEXT,
    "projectId" TEXT,
    "hotelBookingId" TEXT,
    "accommodationClass" "AccommodationClass" NOT NULL DEFAULT 'STANDARD',
    "status" "AccommodationStatus" NOT NULL DEFAULT 'RESERVED',
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_vehicles" (
    "id" TEXT NOT NULL,
    "source" "TransportVehicleSource" NOT NULL DEFAULT 'HIRED',
    "assetId" TEXT,
    "supplierId" TEXT,
    "vehicleType" "TransportVehicleType" NOT NULL DEFAULT 'SEDAN',
    "make" TEXT,
    "model" TEXT,
    "plateNumber" TEXT,
    "plateEmirate" TEXT,
    "year" INTEGER,
    "capacity" INTEGER DEFAULT 4,
    "color" TEXT,
    "dailyRate" DECIMAL(12,2),
    "monthlyRate" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "rentalStart" TIMESTAMP(3),
    "rentalEnd" TIMESTAMP(3),
    "mileageLimit" INTEGER,
    "insuranceRef" TEXT,
    "purchaseOrderId" TEXT,
    "postedTxnId" TEXT,
    "projectId" TEXT,
    "fleetClass" "TransportFleetClass" NOT NULL DEFAULT 'PASSENGER',
    "returnLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_drivers" (
    "id" TEXT NOT NULL,
    "source" "TransportDriverSource" NOT NULL DEFAULT 'HIRED',
    "driverId" TEXT,
    "supplierId" TEXT,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minRestHours" INTEGER NOT NULL DEFAULT 10,
    "onDutySince" TIMESTAMP(3),
    "lastWrapAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_orders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "TransportOrderType" NOT NULL DEFAULT 'TALENT_PICKUP',
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "vehicleId" TEXT,
    "driverId" TEXT,
    "status" "TransportStatus" NOT NULL DEFAULT 'REQUESTED',
    "purpose" TEXT,
    "passengerNote" TEXT,
    "notes" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "onboardAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pickupLat" DECIMAL(10,7),
    "pickupLng" DECIMAL(10,7),
    "dropLat" DECIMAL(10,7),
    "dropLng" DECIMAL(10,7),
    "priority" TEXT,
    "callSheetId" TEXT,
    "genSource" TEXT,
    "chatChannelId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_passengers" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,

    CONSTRAINT "transport_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_overlays" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "RouteKind" NOT NULL DEFAULT 'STANDARD',
    "points" JSONB NOT NULL,
    "constraints" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_overlays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shuttle_routes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "frequency" "ShuttleFrequency" NOT NULL DEFAULT 'DAILY',
    "daysOfWeek" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "departureTime" TEXT,
    "capacity" INTEGER,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shuttle_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shuttle_stops" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "arrivalTime" TEXT,
    "gpsCoordinates" TEXT,
    "notes" TEXT,

    CONSTRAINT "shuttle_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shuttle_riders" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "pickupStopId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shuttle_riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_representations" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "repType" "RepresentationType" NOT NULL DEFAULT 'AGENCY',
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "commissionPct" DECIMAL(5,2),
    "territory" TEXT,
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_representations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_credits" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "creditType" "CreditType" NOT NULL DEFAULT 'FILM',
    "title" TEXT NOT NULL,
    "role" TEXT,
    "year" INTEGER,
    "productionCompany" TEXT,
    "director" TEXT,
    "link" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_interactions" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL DEFAULT 'NOTE',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "notes" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followUpDate" TIMESTAMP(3),
    "projectId" TEXT,
    "castingCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LIST',
    "ownerId" TEXT,
    "projectId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_list_members" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audition_packages" (
    "id" TEXT NOT NULL,
    "castingCallId" TEXT,
    "title" TEXT NOT NULL,
    "sides" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ndaUrl" TEXT,
    "characterBrief" TEXT,
    "moodBoards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referenceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productionNotes" TEXT,
    "deadline" TIMESTAMP(3),
    "requiredFormat" TEXT,
    "minResolution" TEXT,
    "maxDurationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audition_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_tape_submissions" (
    "id" TEXT NOT NULL,
    "packageId" TEXT,
    "submissionId" TEXT,
    "talentId" TEXT,
    "videoUrl" TEXT NOT NULL,
    "slateUrl" TEXT,
    "materials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "format" TEXT,
    "resolution" TEXT,
    "durationSec" INTEGER,
    "formatOk" BOOLEAN,
    "resolutionOk" BOOLEAN,
    "durationOk" BOOLEAN,
    "deadlineOk" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_tape_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "scopeType" "ChannelScope" NOT NULL,
    "scopeId" TEXT,
    "title" TEXT NOT NULL,
    "isPTT" BOOLEAN NOT NULL DEFAULT false,
    "isBroadcast" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChannelMemberRole" NOT NULL DEFAULT 'MEMBER',
    "derivedFromAssignment" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "replyToId" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "contentHash" TEXT,
    "clientId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageVersion" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "sharedPath" TEXT,
    "sharedBytes" INTEGER,
    "originalPath" TEXT,
    "originalBytes" INTEGER,
    "transcript" TEXT,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PttSession" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "PttSessionStatus" NOT NULL DEFAULT 'LIVE',
    "participants" TEXT[],
    "recordingPath" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PttSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditAccessLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'VIEW',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL DEFAULT 'PRODUCTION',
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "room" TEXT,
    "location" TEXT,
    "recurrenceRule" TEXT,
    "parentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "role" TEXT,
    "department" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "rsvp" TEXT,
    "attended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "kind" "AgendaItemKind" NOT NULL DEFAULT 'DISCUSSION',
    "minutes" INTEGER,
    "presenter" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "notes" TEXT,

    CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingMinute" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "decision" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingMinute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverShift" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "projectId" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'ON_SHIFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastLat" DECIMAL(10,7),
    "lastLng" DECIMAL(10,7),
    "lastPingAt" TIMESTAMP(3),

    CONSTRAINT "DriverShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "transportOrderId" TEXT,
    "shiftId" TEXT,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "speedKph" DOUBLE PRECISION,
    "headingDeg" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofencePin" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "GeofenceKind" NOT NULL DEFAULT 'BASECAMP',
    "label" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 120,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notifyChannelId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofencePin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofenceCheckin" (
    "id" TEXT NOT NULL,
    "pinId" TEXT NOT NULL,
    "driverId" TEXT,
    "userId" TEXT,
    "vehicleId" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL DEFAULT 'graphite',
    "mode" TEXT NOT NULL DEFAULT 'dark',
    "readingMode" BOOLEAN NOT NULL DEFAULT true,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "density" TEXT NOT NULL DEFAULT 'comfortable',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgThemePolicy" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "mode" TEXT NOT NULL DEFAULT 'restricted',
    "allowedThemeIds" TEXT[] DEFAULT ARRAY['graphite', 'studio', 'ink']::TEXT[],
    "forcedThemeId" TEXT,
    "defaultThemeId" TEXT NOT NULL DEFAULT 'graphite',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgThemePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "projectId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movement_orders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationId" TEXT,
    "title" TEXT,
    "date" TIMESTAMP(3),
    "kind" TEXT NOT NULL DEFAULT 'TO_LOCATION',
    "fromLabel" TEXT,
    "fromLat" DOUBLE PRECISION,
    "fromLng" DOUBLE PRECISION,
    "toLabel" TEXT,
    "toLat" DOUBLE PRECISION,
    "toLng" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "driveMinutes" INTEGER,
    "convoyVehicles" INTEGER,
    "parkingNotes" TEXT,
    "facilitiesNotes" TEXT,
    "mapUrl" TEXT,
    "contacts" JSONB,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movement_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "projectId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "promptChars" INTEGER,
    "outputChars" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "confidence" DECIMAL(5,2),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "revisionId" TEXT,
    "title" TEXT,
    "logline" TEXT,
    "genre" TEXT,
    "synopsis" TEXT,
    "comments" JSONB,
    "comps" JSONB,
    "characters" JSONB,
    "grades" JSONB,
    "recommendation" TEXT,
    "facts" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_currency_key" ON "fx_rates"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_provider_key" ON "integration_connections"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_userId_idx" ON "two_factor_backup_codes"("userId");

-- CreateIndex
CREATE INDEX "BreakdownShare_sharedToId_readAt_idx" ON "BreakdownShare"("sharedToId", "readAt");

-- CreateIndex
CREATE INDEX "BreakdownShare_projectId_idx" ON "BreakdownShare"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_templates_key_key" ON "permission_templates"("key");

-- CreateIndex
CREATE INDEX "project_role_assignments_userId_idx" ON "project_role_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_role_assignments_projectId_userId_key" ON "project_role_assignments"("projectId", "userId");

-- CreateIndex
CREATE INDEX "otp_challenges_entityType_entityId_idx" ON "otp_challenges"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_prefix_key" ON "document_sequences"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationNumber_key" ON "quotations"("quotationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_key" ON "payments"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_expenseNumber_key" ON "expenses"("expenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "assets_qrCode_key" ON "assets"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_employeeId_key" ON "drivers"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "driver_payouts_payoutNumber_key" ON "driver_payouts"("payoutNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rental_bookings_bookingNumber_key" ON "rental_bookings"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_contractNumber_key" ON "rental_contracts"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_bookingId_key" ON "rental_contracts"("bookingId");

-- CreateIndex
CREATE INDEX "fuel_logs_projectId_idx" ON "fuel_logs"("projectId");

-- CreateIndex
CREATE INDEX "fuel_logs_transportVehicleId_idx" ON "fuel_logs"("transportVehicleId");

-- CreateIndex
CREATE INDEX "fuel_logs_assetId_idx" ON "fuel_logs"("assetId");

-- CreateIndex
CREATE INDEX "fuel_logs_transportDriverId_idx" ON "fuel_logs"("transportDriverId");

-- CreateIndex
CREATE UNIQUE INDEX "damage_reports_reportNumber_key" ON "damage_reports"("reportNumber");

-- CreateIndex
CREATE UNIQUE INDEX "incident_reports_incidentNumber_key" ON "incident_reports"("incidentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplierCode_key" ON "suppliers"("supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_vendorId_key" ON "suppliers"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "production_projects_projectNumber_key" ON "production_projects"("projectNumber");

-- CreateIndex
CREATE INDEX "production_projects_productionCountryId_idx" ON "production_projects"("productionCountryId");

-- CreateIndex
CREATE UNIQUE INDEX "project_globals_staging_projectId_key" ON "project_globals_staging"("projectId");

-- CreateIndex
CREATE INDEX "coa_mapping_table_masterCode_idx" ON "coa_mapping_table"("masterCode");

-- CreateIndex
CREATE UNIQUE INDEX "coa_mapping_table_sourceSystem_externalCode_key" ON "coa_mapping_table"("sourceSystem", "externalCode");

-- CreateIndex
CREATE UNIQUE INDEX "master_locations_code_key" ON "master_locations"("code");

-- CreateIndex
CREATE INDEX "master_locations_status_idx" ON "master_locations"("status");

-- CreateIndex
CREATE INDEX "master_locations_country_region_idx" ON "master_locations"("country", "region");

-- CreateIndex
CREATE INDEX "location_media_masterLocationId_idx" ON "location_media"("masterLocationId");

-- CreateIndex
CREATE INDEX "locations_projectId_idx" ON "locations"("projectId");

-- CreateIndex
CREATE INDEX "locations_masterLocationId_idx" ON "locations"("masterLocationId");

-- CreateIndex
CREATE INDEX "location_needs_projectId_idx" ON "location_needs"("projectId");

-- CreateIndex
CREATE INDEX "location_need_options_needId_idx" ON "location_need_options"("needId");

-- CreateIndex
CREATE INDEX "location_need_options_locationId_idx" ON "location_need_options"("locationId");

-- CreateIndex
CREATE INDEX "scout_visits_projectId_idx" ON "scout_visits"("projectId");

-- CreateIndex
CREATE INDEX "scout_visits_masterLocationId_idx" ON "scout_visits"("masterLocationId");

-- CreateIndex
CREATE INDEX "scout_visit_stops_visitId_idx" ON "scout_visit_stops"("visitId");

-- CreateIndex
CREATE INDEX "scout_visit_stops_needId_idx" ON "scout_visit_stops"("needId");

-- CreateIndex
CREATE INDEX "scout_visit_stops_locationId_idx" ON "scout_visit_stops"("locationId");

-- CreateIndex
CREATE INDEX "scout_visit_members_visitId_idx" ON "scout_visit_members"("visitId");

-- CreateIndex
CREATE INDEX "scout_visit_members_crewId_idx" ON "scout_visit_members"("crewId");

-- CreateIndex
CREATE UNIQUE INDEX "clearance_packs_token_key" ON "clearance_packs"("token");

-- CreateIndex
CREATE INDEX "clearance_packs_projectId_idx" ON "clearance_packs"("projectId");

-- CreateIndex
CREATE INDEX "clearance_packs_visitId_idx" ON "clearance_packs"("visitId");

-- CreateIndex
CREATE INDEX "clearance_packs_token_idx" ON "clearance_packs"("token");

-- CreateIndex
CREATE INDEX "clearance_pack_members_packId_idx" ON "clearance_pack_members"("packId");

-- CreateIndex
CREATE INDEX "clearance_pack_members_crewId_idx" ON "clearance_pack_members"("crewId");

-- CreateIndex
CREATE INDEX "clearance_pack_accesses_packId_idx" ON "clearance_pack_accesses"("packId");

-- CreateIndex
CREATE INDEX "scout_assignments_projectId_idx" ON "scout_assignments"("projectId");

-- CreateIndex
CREATE INDEX "scout_assignments_status_idx" ON "scout_assignments"("status");

-- CreateIndex
CREATE INDEX "scout_submissions_assignmentId_idx" ON "scout_submissions"("assignmentId");

-- CreateIndex
CREATE INDEX "scout_submissions_status_idx" ON "scout_submissions"("status");

-- CreateIndex
CREATE INDEX "tech_recces_locationId_idx" ON "tech_recces"("locationId");

-- CreateIndex
CREATE INDEX "recce_notes_techRecceId_idx" ON "recce_notes"("techRecceId");

-- CreateIndex
CREATE INDEX "location_evaluations_locationId_idx" ON "location_evaluations"("locationId");

-- CreateIndex
CREATE INDEX "photo_plates_projectId_idx" ON "photo_plates"("projectId");

-- CreateIndex
CREATE INDEX "photo_plates_locationId_idx" ON "photo_plates"("locationId");

-- CreateIndex
CREATE INDEX "photo_plates_visitId_idx" ON "photo_plates"("visitId");

-- CreateIndex
CREATE INDEX "scene_change_requests_projectId_idx" ON "scene_change_requests"("projectId");

-- CreateIndex
CREATE INDEX "scene_change_requests_locationId_idx" ON "scene_change_requests"("locationId");

-- CreateIndex
CREATE INDEX "scene_change_requests_status_idx" ON "scene_change_requests"("status");

-- CreateIndex
CREATE INDEX "location_permits_locationId_idx" ON "location_permits"("locationId");

-- CreateIndex
CREATE INDEX "location_permits_masterLocationId_idx" ON "location_permits"("masterLocationId");

-- CreateIndex
CREATE INDEX "location_permits_status_idx" ON "location_permits"("status");

-- CreateIndex
CREATE INDEX "location_permits_permitType_idx" ON "location_permits"("permitType");

-- CreateIndex
CREATE UNIQUE INDEX "permit_authorities_name_key" ON "permit_authorities"("name");

-- CreateIndex
CREATE INDEX "location_risks_locationId_idx" ON "location_risks"("locationId");

-- CreateIndex
CREATE INDEX "location_risks_status_idx" ON "location_risks"("status");

-- CreateIndex
CREATE INDEX "location_documents_locationId_idx" ON "location_documents"("locationId");

-- CreateIndex
CREATE INDEX "location_documents_masterLocationId_idx" ON "location_documents"("masterLocationId");

-- CreateIndex
CREATE INDEX "location_documents_category_idx" ON "location_documents"("category");

-- CreateIndex
CREATE INDEX "location_documents_expiryDate_idx" ON "location_documents"("expiryDate");

-- CreateIndex
CREATE INDEX "location_security_locationId_idx" ON "location_security"("locationId");

-- CreateIndex
CREATE INDEX "location_security_masterLocationId_idx" ON "location_security"("masterLocationId");

-- CreateIndex
CREATE INDEX "location_payments_locationId_idx" ON "location_payments"("locationId");

-- CreateIndex
CREATE INDEX "location_payments_masterLocationId_idx" ON "location_payments"("masterLocationId");

-- CreateIndex
CREATE INDEX "location_payments_status_idx" ON "location_payments"("status");

-- CreateIndex
CREATE INDEX "timecards_projectId_idx" ON "timecards"("projectId");

-- CreateIndex
CREATE INDEX "project_documents_projectId_idx" ON "project_documents"("projectId");

-- CreateIndex
CREATE INDEX "production_strips_projectId_idx" ON "production_strips"("projectId");

-- CreateIndex
CREATE INDEX "schedule_scenarios_projectId_idx" ON "schedule_scenarios"("projectId");

-- CreateIndex
CREATE INDEX "script_documents_projectId_idx" ON "script_documents"("projectId");

-- CreateIndex
CREATE INDEX "script_documents_masterScriptId_idx" ON "script_documents"("masterScriptId");

-- CreateIndex
CREATE UNIQUE INDEX "master_scripts_code_key" ON "master_scripts"("code");

-- CreateIndex
CREATE INDEX "master_script_revisions_masterScriptId_idx" ON "master_script_revisions"("masterScriptId");

-- CreateIndex
CREATE INDEX "script_audio_notes_revisionId_idx" ON "script_audio_notes"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "audio_engines_key_key" ON "audio_engines"("key");

-- CreateIndex
CREATE INDEX "audio_routing_policies_projectId_idx" ON "audio_routing_policies"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "audio_routing_policies_scope_projectId_capability_key" ON "audio_routing_policies"("scope", "projectId", "capability");

-- CreateIndex
CREATE INDEX "voice_profiles_scope_projectId_idx" ON "voice_profiles"("scope", "projectId");

-- CreateIndex
CREATE INDEX "voice_profiles_masterScriptId_idx" ON "voice_profiles"("masterScriptId");

-- CreateIndex
CREATE INDEX "character_voice_assignments_masterScriptId_idx" ON "character_voice_assignments"("masterScriptId");

-- CreateIndex
CREATE UNIQUE INDEX "character_voice_assignments_revisionId_characterName_key" ON "character_voice_assignments"("revisionId", "characterName");

-- CreateIndex
CREATE INDEX "pronunciation_entries_scope_projectId_idx" ON "pronunciation_entries"("scope", "projectId");

-- CreateIndex
CREATE INDEX "pronunciation_entries_revisionId_idx" ON "pronunciation_entries"("revisionId");

-- CreateIndex
CREATE INDEX "audio_render_jobs_projectId_status_idx" ON "audio_render_jobs"("projectId", "status");

-- CreateIndex
CREATE INDEX "audio_render_jobs_revisionId_idx" ON "audio_render_jobs"("revisionId");

-- CreateIndex
CREATE INDEX "audio_assets_projectId_status_idx" ON "audio_assets"("projectId", "status");

-- CreateIndex
CREATE INDEX "audio_assets_revisionId_kind_idx" ON "audio_assets"("revisionId", "kind");

-- CreateIndex
CREATE INDEX "audio_assets_jobId_idx" ON "audio_assets"("jobId");

-- CreateIndex
CREATE INDEX "voice_usage_records_projectId_createdAt_idx" ON "voice_usage_records"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "voice_usage_records_userId_createdAt_idx" ON "voice_usage_records"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "voice_usage_records_engineKey_createdAt_idx" ON "voice_usage_records"("engineKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "usage_quotas_scope_projectId_userId_period_key" ON "usage_quotas"("scope", "projectId", "userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "line_synthesis_cache_cacheKey_key" ON "line_synthesis_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "line_synthesis_cache_cacheKey_idx" ON "line_synthesis_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "audio_layer_assets_type_category_idx" ON "audio_layer_assets"("type", "category");

-- CreateIndex
CREATE INDEX "audio_layer_assets_scope_projectId_idx" ON "audio_layer_assets"("scope", "projectId");

-- CreateIndex
CREATE INDEX "scene_audio_cues_revisionId_sceneNumber_idx" ON "scene_audio_cues"("revisionId", "sceneNumber");

-- CreateIndex
CREATE INDEX "scene_audio_cues_revisionId_layerType_idx" ON "scene_audio_cues"("revisionId", "layerType");

-- CreateIndex
CREATE UNIQUE INDEX "audio_share_links_token_key" ON "audio_share_links"("token");

-- CreateIndex
CREATE INDEX "audio_share_links_assetId_idx" ON "audio_share_links"("assetId");

-- CreateIndex
CREATE INDEX "audio_share_links_projectId_idx" ON "audio_share_links"("projectId");

-- CreateIndex
CREATE INDEX "script_revisions_documentId_idx" ON "script_revisions"("documentId");

-- CreateIndex
CREATE INDEX "script_bookmarks_revisionId_idx" ON "script_bookmarks"("revisionId");

-- CreateIndex
CREATE INDEX "tag_categories_projectId_idx" ON "tag_categories"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_categories_projectId_key_key" ON "tag_categories"("projectId", "key");

-- CreateIndex
CREATE INDEX "script_scenes_revisionId_idx" ON "script_scenes"("revisionId");

-- CreateIndex
CREATE INDEX "script_coverage_sceneId_idx" ON "script_coverage"("sceneId");

-- CreateIndex
CREATE INDEX "script_coverage_revisionId_idx" ON "script_coverage"("revisionId");

-- CreateIndex
CREATE INDEX "take_logs_coverageId_idx" ON "take_logs"("coverageId");

-- CreateIndex
CREATE INDEX "hot_cost_accruals_projectId_idx" ON "hot_cost_accruals"("projectId");

-- CreateIndex
CREATE INDEX "annotation_layers_documentId_idx" ON "annotation_layers"("documentId");

-- CreateIndex
CREATE INDEX "sides_jobs_projectId_idx" ON "sides_jobs"("projectId");

-- CreateIndex
CREATE INDEX "layer_shares_layerId_idx" ON "layer_shares"("layerId");

-- CreateIndex
CREATE INDEX "annotations_revisionId_idx" ON "annotations"("revisionId");

-- CreateIndex
CREATE INDEX "annotations_layerId_idx" ON "annotations"("layerId");

-- CreateIndex
CREATE INDEX "breakdown_elements_projectId_idx" ON "breakdown_elements"("projectId");

-- CreateIndex
CREATE INDEX "breakdown_elements_stripId_idx" ON "breakdown_elements"("stripId");

-- CreateIndex
CREATE INDEX "script_sync_logs_projectId_idx" ON "script_sync_logs"("projectId");

-- CreateIndex
CREATE INDEX "creative_briefs_projectId_idx" ON "creative_briefs"("projectId");

-- CreateIndex
CREATE INDEX "deliverables_projectId_idx" ON "deliverables"("projectId");

-- CreateIndex
CREATE INDEX "usage_rights_projectId_idx" ON "usage_rights"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ppm_checklists_projectId_key" ON "ppm_checklists"("projectId");

-- CreateIndex
CREATE INDEX "project_transactions_projectId_idx" ON "project_transactions"("projectId");

-- CreateIndex
CREATE INDEX "project_transactions_accountCode_idx" ON "project_transactions"("accountCode");

-- CreateIndex
CREATE INDEX "project_transactions_zatcaUuid_idx" ON "project_transactions"("zatcaUuid");

-- CreateIndex
CREATE INDEX "accounting_periods_projectId_idx" ON "accounting_periods"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_projectId_period_key" ON "accounting_periods"("projectId", "period");

-- CreateIndex
CREATE INDEX "production_payroll_runs_projectId_idx" ON "production_payroll_runs"("projectId");

-- CreateIndex
CREATE INDEX "project_bank_recons_projectId_idx" ON "project_bank_recons"("projectId");

-- CreateIndex
CREATE INDEX "daily_production_reports_projectId_idx" ON "daily_production_reports"("projectId");

-- CreateIndex
CREATE INDEX "daily_production_reports_reportDate_idx" ON "daily_production_reports"("reportDate");

-- CreateIndex
CREATE INDEX "cash_advances_projectId_idx" ON "cash_advances"("projectId");

-- CreateIndex
CREATE INDEX "cash_advances_status_idx" ON "cash_advances"("status");

-- CreateIndex
CREATE INDEX "card_transactions_projectId_idx" ON "card_transactions"("projectId");

-- CreateIndex
CREATE INDEX "card_transactions_status_idx" ON "card_transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claims_claimNumber_key" ON "expense_claims"("claimNumber");

-- CreateIndex
CREATE INDEX "expense_claims_projectId_idx" ON "expense_claims"("projectId");

-- CreateIndex
CREATE INDEX "expense_claims_status_idx" ON "expense_claims"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_prNumber_key" ON "purchase_requests"("prNumber");

-- CreateIndex
CREATE INDEX "purchase_requests_projectId_idx" ON "purchase_requests"("projectId");

-- CreateIndex
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");

-- CreateIndex
CREATE INDEX "production_vendors_projectId_idx" ON "production_vendors"("projectId");

-- CreateIndex
CREATE INDEX "pending_vendors_projectId_idx" ON "pending_vendors"("projectId");

-- CreateIndex
CREATE INDEX "pending_vendors_status_idx" ON "pending_vendors"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_projectId_idx" ON "purchase_orders"("projectId");

-- CreateIndex
CREATE INDEX "cost_report_snapshots_projectId_idx" ON "cost_report_snapshots"("projectId");

-- CreateIndex
CREATE INDEX "petty_cash_floats_projectId_idx" ON "petty_cash_floats"("projectId");

-- CreateIndex
CREATE INDEX "petty_cash_txns_floatId_idx" ON "petty_cash_txns"("floatId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_rolls_projectId_key" ON "credit_rolls"("projectId");

-- CreateIndex
CREATE INDEX "overages_projectId_idx" ON "overages"("projectId");

-- CreateIndex
CREATE INDEX "budget_transfers_projectId_idx" ON "budget_transfers"("projectId");

-- CreateIndex
CREATE INDEX "per_diems_projectId_idx" ON "per_diems"("projectId");

-- CreateIndex
CREATE INDEX "call_sheets_projectId_idx" ON "call_sheets"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items"("sku");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_idx" ON "stock_movements"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "gl_accounts_code_key" ON "gl_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_entryNumber_key" ON "journal_entries"("entryNumber");

-- CreateIndex
CREATE INDEX "journal_entries_sourceType_sourceId_idx" ON "journal_entries"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "journal_lines_entryId_idx" ON "journal_lines"("entryId");

-- CreateIndex
CREATE INDEX "journal_lines_accountId_idx" ON "journal_lines"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_bank_accounts_glAccountId_key" ON "ledger_bank_accounts"("glAccountId");

-- CreateIndex
CREATE INDEX "approval_requests_entityType_entityId_idx" ON "approval_requests"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "approval_steps_requestId_idx" ON "approval_steps"("requestId");

-- CreateIndex
CREATE INDEX "budget_lifecycle_logs_projectId_idx" ON "budget_lifecycle_logs"("projectId");

-- CreateIndex
CREATE INDEX "budget_lifecycle_logs_budgetVersionId_idx" ON "budget_lifecycle_logs"("budgetVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_globals_budgetVersionId_key_key" ON "budget_globals"("budgetVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_vendors_supplierId_key" ON "maintenance_vendors"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_maintenance_jobs_jobNumber_key" ON "vendor_maintenance_jobs"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_quotations_quotationNumber_key" ON "vendor_quotations"("quotationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invoices_invoiceNumber_key" ON "vendor_invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_payments_paymentNumber_key" ON "vendor_payments"("paymentNumber");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "status_logs_module_recordId_idx" ON "status_logs"("module", "recordId");

-- CreateIndex
CREATE INDEX "status_logs_changedById_idx" ON "status_logs"("changedById");

-- CreateIndex
CREATE INDEX "status_logs_changedAt_idx" ON "status_logs"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeNumber_key" ON "employees"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_employeeId_key" ON "driver_profiles"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_module_key" ON "role_permissions"("role", "module");

-- CreateIndex
CREATE INDEX "reminder_logs_invoiceId_idx" ON "reminder_logs"("invoiceId");

-- CreateIndex
CREATE INDEX "crew_members_parentSystemUserId_idx" ON "crew_members"("parentSystemUserId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_reference_key" ON "payroll_runs"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_periodMonth_periodYear_key" ON "payroll_runs"("periodMonth", "periodYear");

-- CreateIndex
CREATE INDEX "geo_nodes_parentId_idx" ON "geo_nodes"("parentId");

-- CreateIndex
CREATE INDEX "geo_nodes_level_idx" ON "geo_nodes"("level");

-- CreateIndex
CREATE INDEX "jurisdiction_tax_rules_geoNodeId_idx" ON "jurisdiction_tax_rules"("geoNodeId");

-- CreateIndex
CREATE INDEX "jurisdiction_tax_rules_isActive_idx" ON "jurisdiction_tax_rules"("isActive");

-- CreateIndex
CREATE INDEX "labor_bodies_kind_idx" ON "labor_bodies"("kind");

-- CreateIndex
CREATE INDEX "agreements_laborBodyId_idx" ON "agreements"("laborBodyId");

-- CreateIndex
CREATE INDEX "agreements_status_idx" ON "agreements"("status");

-- CreateIndex
CREATE INDEX "classifications_agreementId_idx" ON "classifications"("agreementId");

-- CreateIndex
CREATE INDEX "rate_rules_agreementId_idx" ON "rate_rules"("agreementId");

-- CreateIndex
CREATE INDEX "rate_rules_rateType_idx" ON "rate_rules"("rateType");

-- CreateIndex
CREATE INDEX "rate_rules_effectiveDate_idx" ON "rate_rules"("effectiveDate");

-- CreateIndex
CREATE INDEX "rate_change_proposals_status_idx" ON "rate_change_proposals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "project_labor_configs_projectId_key" ON "project_labor_configs"("projectId");

-- CreateIndex
CREATE INDEX "project_rate_rules_projectId_idx" ON "project_rate_rules"("projectId");

-- CreateIndex
CREATE INDEX "incentive_programs_geoNodeId_idx" ON "incentive_programs"("geoNodeId");

-- CreateIndex
CREATE INDEX "incentive_claims_projectId_idx" ON "incentive_claims"("projectId");

-- CreateIndex
CREATE INDEX "project_incentives_projectId_idx" ON "project_incentives"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_key_key" ON "workflow_definitions"("key");

-- CreateIndex
CREATE INDEX "workflow_definitions_entityType_idx" ON "workflow_definitions"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_nodes_definitionId_order_key" ON "workflow_nodes"("definitionId", "order");

-- CreateIndex
CREATE INDEX "workflow_instances_entityType_entityId_idx" ON "workflow_instances"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "workflow_instances_status_idx" ON "workflow_instances"("status");

-- CreateIndex
CREATE INDEX "approval_actions_instanceId_idx" ON "approval_actions"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "traveler_profiles_crewMemberId_key" ON "traveler_profiles"("crewMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "traveler_profiles_talentProfileId_key" ON "traveler_profiles"("talentProfileId");

-- CreateIndex
CREATE INDEX "traveler_profiles_personType_idx" ON "traveler_profiles"("personType");

-- CreateIndex
CREATE INDEX "traveler_profiles_accompaniesId_idx" ON "traveler_profiles"("accompaniesId");

-- CreateIndex
CREATE INDEX "traveler_visas_travelerId_idx" ON "traveler_visas"("travelerId");

-- CreateIndex
CREATE INDEX "traveler_documents_travelerId_type_idx" ON "traveler_documents"("travelerId", "type");

-- CreateIndex
CREATE INDEX "travel_arrivals_travelerId_idx" ON "travel_arrivals"("travelerId");

-- CreateIndex
CREATE INDEX "travel_arrivals_projectId_arrivalTime_idx" ON "travel_arrivals"("projectId", "arrivalTime");

-- CreateIndex
CREATE INDEX "trips_projectId_status_idx" ON "trips"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "itineraries_purchaseOrderId_key" ON "itineraries"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "itineraries_tripId_idx" ON "itineraries"("tripId");

-- CreateIndex
CREATE INDEX "flight_bookings_itineraryId_idx" ON "flight_bookings"("itineraryId");

-- CreateIndex
CREATE INDEX "hotel_bookings_itineraryId_idx" ON "hotel_bookings"("itineraryId");

-- CreateIndex
CREATE INDEX "car_bookings_itineraryId_idx" ON "car_bookings"("itineraryId");

-- CreateIndex
CREATE INDEX "visa_applications_tripId_idx" ON "visa_applications"("tripId");

-- CreateIndex
CREATE INDEX "visa_applications_status_idx" ON "visa_applications"("status");

-- CreateIndex
CREATE INDEX "contract_templates_type_isActive_idx" ON "contract_templates"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "clause_templates_code_key" ON "clause_templates"("code");

-- CreateIndex
CREATE INDEX "clause_templates_category_isActive_idx" ON "clause_templates"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "project_contracts_contractNumber_key" ON "project_contracts"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "project_contracts_esignEnvelopeId_key" ON "project_contracts"("esignEnvelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "project_contracts_purchaseOrderId_key" ON "project_contracts"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "project_contracts_projectId_status_idx" ON "project_contracts"("projectId", "status");

-- CreateIndex
CREATE INDEX "project_contracts_budgetLineItemId_idx" ON "project_contracts"("budgetLineItemId");

-- CreateIndex
CREATE INDEX "project_contracts_productionCrewId_idx" ON "project_contracts"("productionCrewId");

-- CreateIndex
CREATE INDEX "contract_parties_contractId_signerOrder_idx" ON "contract_parties"("contractId", "signerOrder");

-- CreateIndex
CREATE INDEX "signature_audit_logs_contractId_createdAt_idx" ON "signature_audit_logs"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "global_talent_profiles_status_idx" ON "global_talent_profiles"("status");

-- CreateIndex
CREATE INDEX "global_talent_profiles_fullName_idx" ON "global_talent_profiles"("fullName");

-- CreateIndex
CREATE INDEX "casting_calls_projectId_status_idx" ON "casting_calls"("projectId", "status");

-- CreateIndex
CREATE INDEX "casting_calls_breakdownElementId_idx" ON "casting_calls"("breakdownElementId");

-- CreateIndex
CREATE INDEX "character_profiles_projectId_idx" ON "character_profiles"("projectId");

-- CreateIndex
CREATE INDEX "casting_submissions_castingCallId_status_idx" ON "casting_submissions"("castingCallId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "casting_submissions_castingCallId_talentId_key" ON "casting_submissions"("castingCallId", "talentId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_ops_checklists_submissionId_key" ON "talent_ops_checklists"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_negotiations_submissionId_key" ON "talent_negotiations"("submissionId");

-- CreateIndex
CREATE INDEX "casting_auditions_submissionId_status_idx" ON "casting_auditions"("submissionId", "status");

-- CreateIndex
CREATE INDEX "consent_logs_talentId_type_idx" ON "consent_logs"("talentId", "type");

-- CreateIndex
CREATE INDEX "consent_logs_projectId_idx" ON "consent_logs"("projectId");

-- CreateIndex
CREATE INDEX "talent_performance_reviews_talentId_idx" ON "talent_performance_reviews"("talentId");

-- CreateIndex
CREATE INDEX "talent_performance_reviews_projectId_idx" ON "talent_performance_reviews"("projectId");

-- CreateIndex
CREATE INDEX "accommodation_properties_type_idx" ON "accommodation_properties"("type");

-- CreateIndex
CREATE INDEX "room_inventory_propertyId_idx" ON "room_inventory"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_assignments_hotelBookingId_key" ON "accommodation_assignments"("hotelBookingId");

-- CreateIndex
CREATE INDEX "accommodation_assignments_projectId_idx" ON "accommodation_assignments"("projectId");

-- CreateIndex
CREATE INDEX "accommodation_assignments_travelerId_idx" ON "accommodation_assignments"("travelerId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_vehicles_assetId_key" ON "transport_vehicles"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_vehicles_purchaseOrderId_key" ON "transport_vehicles"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "transport_vehicles_projectId_idx" ON "transport_vehicles"("projectId");

-- CreateIndex
CREATE INDEX "transport_vehicles_supplierId_idx" ON "transport_vehicles"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_drivers_driverId_key" ON "transport_drivers"("driverId");

-- CreateIndex
CREATE INDEX "transport_drivers_supplierId_idx" ON "transport_drivers"("supplierId");

-- CreateIndex
CREATE INDEX "transport_orders_projectId_scheduledAt_idx" ON "transport_orders"("projectId", "scheduledAt");

-- CreateIndex
CREATE INDEX "transport_orders_status_idx" ON "transport_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transport_passengers_orderId_travelerId_key" ON "transport_passengers"("orderId", "travelerId");

-- CreateIndex
CREATE INDEX "route_overlays_projectId_idx" ON "route_overlays"("projectId");

-- CreateIndex
CREATE INDEX "shuttle_routes_projectId_idx" ON "shuttle_routes"("projectId");

-- CreateIndex
CREATE INDEX "shuttle_stops_routeId_idx" ON "shuttle_stops"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "shuttle_riders_routeId_travelerId_key" ON "shuttle_riders"("routeId", "travelerId");

-- CreateIndex
CREATE INDEX "talent_representations_talentId_idx" ON "talent_representations"("talentId");

-- CreateIndex
CREATE INDEX "talent_credits_talentId_idx" ON "talent_credits"("talentId");

-- CreateIndex
CREATE INDEX "talent_interactions_talentId_idx" ON "talent_interactions"("talentId");

-- CreateIndex
CREATE INDEX "talent_interactions_followUpDate_idx" ON "talent_interactions"("followUpDate");

-- CreateIndex
CREATE UNIQUE INDEX "talent_list_members_listId_talentId_key" ON "talent_list_members"("listId", "talentId");

-- CreateIndex
CREATE INDEX "audition_packages_castingCallId_idx" ON "audition_packages"("castingCallId");

-- CreateIndex
CREATE INDEX "self_tape_submissions_packageId_idx" ON "self_tape_submissions"("packageId");

-- CreateIndex
CREATE INDEX "self_tape_submissions_submissionId_idx" ON "self_tape_submissions"("submissionId");

-- CreateIndex
CREATE INDEX "Channel_scopeType_scopeId_idx" ON "Channel"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "Channel_projectId_idx" ON "Channel"("projectId");

-- CreateIndex
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON "ChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_channelId_clientId_key" ON "Message"("channelId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageVersion_messageId_version_key" ON "MessageVersion"("messageId", "version");

-- CreateIndex
CREATE INDEX "PttSession_channelId_idx" ON "PttSession"("channelId");

-- CreateIndex
CREATE INDEX "AuditAccessLog_targetType_targetId_idx" ON "AuditAccessLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Meeting_projectId_startsAt_idx" ON "Meeting"("projectId", "startsAt");

-- CreateIndex
CREATE INDEX "MeetingAttendee_meetingId_idx" ON "MeetingAttendee"("meetingId");

-- CreateIndex
CREATE INDEX "AgendaItem_meetingId_idx" ON "AgendaItem"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingMinute_meetingId_idx" ON "MeetingMinute"("meetingId");

-- CreateIndex
CREATE INDEX "ActionItem_meetingId_idx" ON "ActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "ActionItem_projectId_status_idx" ON "ActionItem"("projectId", "status");

-- CreateIndex
CREATE INDEX "DriverShift_driverId_status_idx" ON "DriverShift"("driverId", "status");

-- CreateIndex
CREATE INDEX "DriverShift_projectId_idx" ON "DriverShift"("projectId");

-- CreateIndex
CREATE INDEX "LocationPing_driverId_recordedAt_idx" ON "LocationPing"("driverId", "recordedAt");

-- CreateIndex
CREATE INDEX "LocationPing_transportOrderId_recordedAt_idx" ON "LocationPing"("transportOrderId", "recordedAt");

-- CreateIndex
CREATE INDEX "LocationPing_shiftId_idx" ON "LocationPing"("shiftId");

-- CreateIndex
CREATE INDEX "GeofencePin_projectId_active_idx" ON "GeofencePin"("projectId", "active");

-- CreateIndex
CREATE INDEX "GeofenceCheckin_pinId_at_idx" ON "GeofenceCheckin"("pinId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgThemePolicy_scope_key" ON "OrgThemePolicy"("scope");

-- CreateIndex
CREATE INDEX "UserNotification_userId_readAt_idx" ON "UserNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "SavedView_userId_module_idx" ON "SavedView"("userId", "module");

-- CreateIndex
CREATE INDEX "movement_orders_projectId_idx" ON "movement_orders"("projectId");

-- CreateIndex
CREATE INDEX "movement_orders_date_idx" ON "movement_orders"("date");

-- CreateIndex
CREATE INDEX "AiRun_projectId_idx" ON "AiRun"("projectId");

-- CreateIndex
CREATE INDEX "AiRun_task_idx" ON "AiRun"("task");

-- CreateIndex
CREATE INDEX "AiRun_createdAt_idx" ON "AiRun"("createdAt");

-- CreateIndex
CREATE INDEX "CoverageReport_projectId_idx" ON "CoverageReport"("projectId");

-- CreateIndex
CREATE INDEX "CoverageReport_revisionId_idx" ON "CoverageReport"("revisionId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownShare" ADD CONSTRAINT "BreakdownShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownShare" ADD CONSTRAINT "BreakdownShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownShare" ADD CONSTRAINT "BreakdownShare_sharedToId_fkey" FOREIGN KEY ("sharedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "permission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_deductionAppliedById_fkey" FOREIGN KEY ("deductionAppliedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deductionAppliedById_fkey" FOREIGN KEY ("deductionAppliedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_linkedGeneratorId_fkey" FOREIGN KEY ("linkedGeneratorId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_payouts" ADD CONSTRAINT "driver_payouts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_jobs" ADD CONSTRAINT "driver_jobs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_jobs" ADD CONSTRAINT "driver_jobs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_jobs" ADD CONSTRAINT "driver_jobs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tow_couplings" ADD CONSTRAINT "tow_couplings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_transportVehicleId_fkey" FOREIGN KEY ("transportVehicleId") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_transportDriverId_fkey" FOREIGN KEY ("transportDriverId") REFERENCES "transport_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_globalContactId_fkey" FOREIGN KEY ("globalContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_projects" ADD CONSTRAINT "production_projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_projects" ADD CONSTRAINT "production_projects_productionCountryId_fkey" FOREIGN KEY ("productionCountryId") REFERENCES "geo_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_globals_staging" ADD CONSTRAINT "project_globals_staging_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_media" ADD CONSTRAINT "location_media_masterLocationId_fkey" FOREIGN KEY ("masterLocationId") REFERENCES "master_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_masterLocationId_fkey" FOREIGN KEY ("masterLocationId") REFERENCES "master_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_need_options" ADD CONSTRAINT "location_need_options_needId_fkey" FOREIGN KEY ("needId") REFERENCES "location_needs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_visit_stops" ADD CONSTRAINT "scout_visit_stops_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "scout_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_visit_members" ADD CONSTRAINT "scout_visit_members_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "scout_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_pack_members" ADD CONSTRAINT "clearance_pack_members_packId_fkey" FOREIGN KEY ("packId") REFERENCES "clearance_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_pack_accesses" ADD CONSTRAINT "clearance_pack_accesses_packId_fkey" FOREIGN KEY ("packId") REFERENCES "clearance_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_submissions" ADD CONSTRAINT "scout_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "scout_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_recces" ADD CONSTRAINT "tech_recces_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recce_notes" ADD CONSTRAINT "recce_notes_techRecceId_fkey" FOREIGN KEY ("techRecceId") REFERENCES "tech_recces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_evaluations" ADD CONSTRAINT "location_evaluations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_permits" ADD CONSTRAINT "location_permits_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_permits" ADD CONSTRAINT "location_permits_masterLocationId_fkey" FOREIGN KEY ("masterLocationId") REFERENCES "master_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_permits" ADD CONSTRAINT "location_permits_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "permit_authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_risks" ADD CONSTRAINT "location_risks_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_documents" ADD CONSTRAINT "location_documents_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_documents" ADD CONSTRAINT "location_documents_masterLocationId_fkey" FOREIGN KEY ("masterLocationId") REFERENCES "master_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_security" ADD CONSTRAINT "location_security_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_security" ADD CONSTRAINT "location_security_masterLocationId_fkey" FOREIGN KEY ("masterLocationId") REFERENCES "master_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_payments" ADD CONSTRAINT "location_payments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_payments" ADD CONSTRAINT "location_payments_masterLocationId_fkey" FOREIGN KEY ("masterLocationId") REFERENCES "master_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timecards" ADD CONSTRAINT "timecards_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_strips" ADD CONSTRAINT "production_strips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_strips" ADD CONSTRAINT "production_strips_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_documents" ADD CONSTRAINT "script_documents_masterScriptId_fkey" FOREIGN KEY ("masterScriptId") REFERENCES "master_scripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_script_revisions" ADD CONSTRAINT "master_script_revisions_masterScriptId_fkey" FOREIGN KEY ("masterScriptId") REFERENCES "master_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_revisions" ADD CONSTRAINT "script_revisions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "script_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_bookmarks" ADD CONSTRAINT "script_bookmarks_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "script_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_scenes" ADD CONSTRAINT "script_scenes_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "script_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_coverage" ADD CONSTRAINT "script_coverage_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "script_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "take_logs" ADD CONSTRAINT "take_logs_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "script_coverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_layers" ADD CONSTRAINT "annotation_layers_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "script_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layer_shares" ADD CONSTRAINT "layer_shares_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "annotation_layers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "annotation_layers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_elements" ADD CONSTRAINT "breakdown_elements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_elements" ADD CONSTRAINT "breakdown_elements_stripId_fkey" FOREIGN KEY ("stripId") REFERENCES "production_strips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_elements" ADD CONSTRAINT "breakdown_elements_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "script_scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_transactions" ADD CONSTRAINT "project_transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_vendors" ADD CONSTRAINT "production_vendors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_vendors" ADD CONSTRAINT "pending_vendors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "production_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_report_snapshots" ADD CONSTRAINT "cost_report_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_floats" ADD CONSTRAINT "petty_cash_floats_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_txns" ADD CONSTRAINT "petty_cash_txns_floatId_fkey" FOREIGN KEY ("floatId") REFERENCES "petty_cash_floats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_rolls" ADD CONSTRAINT "credit_rolls_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overages" ADD CONSTRAINT "overages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "per_diems" ADD CONSTRAINT "per_diems_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "per_diems" ADD CONSTRAINT "per_diems_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "production_crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sheets" ADD CONSTRAINT "call_sheets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_bank_accounts" ADD CONSTRAINT "ledger_bank_accounts_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_bank_accounts" ADD CONSTRAINT "ledger_bank_accounts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "ledger_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "budget_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lifecycle_logs" ADD CONSTRAINT "budget_lifecycle_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lifecycle_logs" ADD CONSTRAINT "budget_lifecycle_logs_budgetVersionId_fkey" FOREIGN KEY ("budgetVersionId") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_globals" ADD CONSTRAINT "budget_globals_budgetVersionId_fkey" FOREIGN KEY ("budgetVersionId") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fringe_profiles" ADD CONSTRAINT "fringe_profiles_budgetVersionId_fkey" FOREIGN KEY ("budgetVersionId") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_sections" ADD CONSTRAINT "budget_sections_budgetVersionId_fkey" FOREIGN KEY ("budgetVersionId") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "budget_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "budget_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_castTalentId_fkey" FOREIGN KEY ("castTalentId") REFERENCES "global_talent_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_crew" ADD CONSTRAINT "production_crew_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_crew" ADD CONSTRAINT "production_crew_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "crew_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_schedules" ADD CONSTRAINT "production_schedules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_maintenance_jobs" ADD CONSTRAINT "vendor_maintenance_jobs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_maintenance_jobs" ADD CONSTRAINT "vendor_maintenance_jobs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "vendor_maintenance_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tire_records" ADD CONSTRAINT "tire_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tire_records" ADD CONSTRAINT "tire_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tire_records" ADD CONSTRAINT "tire_records_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "vendor_maintenance_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotations" ADD CONSTRAINT "vendor_quotations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotations" ADD CONSTRAINT "vendor_quotations_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "vendor_maintenance_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "vendor_maintenance_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "vendor_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "vendor_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_bank_accounts" ADD CONSTRAINT "company_bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_locations" ADD CONSTRAINT "company_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_parentSystemUserId_fkey" FOREIGN KEY ("parentSystemUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_locations" ADD CONSTRAINT "booking_locations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_nodes" ADD CONSTRAINT "geo_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "geo_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurisdiction_tax_rules" ADD CONSTRAINT "jurisdiction_tax_rules_geoNodeId_fkey" FOREIGN KEY ("geoNodeId") REFERENCES "geo_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_bodies" ADD CONSTRAINT "labor_bodies_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "geo_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_laborBodyId_fkey" FOREIGN KEY ("laborBodyId") REFERENCES "labor_bodies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "rate_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_rules" ADD CONSTRAINT "rate_rules_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_rules" ADD CONSTRAINT "rate_rules_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "classifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_rules" ADD CONSTRAINT "rate_rules_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "rate_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_sources" ADD CONSTRAINT "rate_sources_laborBodyId_fkey" FOREIGN KEY ("laborBodyId") REFERENCES "labor_bodies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_labor_configs" ADD CONSTRAINT "project_labor_configs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_labor_configs" ADD CONSTRAINT "project_labor_configs_geoNodeId_fkey" FOREIGN KEY ("geoNodeId") REFERENCES "geo_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_rate_rules" ADD CONSTRAINT "project_rate_rules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_programs" ADD CONSTRAINT "incentive_programs_geoNodeId_fkey" FOREIGN KEY ("geoNodeId") REFERENCES "geo_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_claims" ADD CONSTRAINT "incentive_claims_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_incentives" ADD CONSTRAINT "project_incentives_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traveler_profiles" ADD CONSTRAINT "traveler_profiles_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "crew_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traveler_profiles" ADD CONSTRAINT "traveler_profiles_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "global_talent_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traveler_profiles" ADD CONSTRAINT "traveler_profiles_accompaniesId_fkey" FOREIGN KEY ("accompaniesId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traveler_visas" ADD CONSTRAINT "traveler_visas_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traveler_documents" ADD CONSTRAINT "traveler_documents_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_arrivals" ADD CONSTRAINT "travel_arrivals_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_arrivals" ADD CONSTRAINT "travel_arrivals_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_arrivals" ADD CONSTRAINT "travel_arrivals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_arrivals" ADD CONSTRAINT "travel_arrivals_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_arrivals" ADD CONSTRAINT "travel_arrivals_transportDriverId_fkey" FOREIGN KEY ("transportDriverId") REFERENCES "transport_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_bookings" ADD CONSTRAINT "flight_bookings_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_bookings" ADD CONSTRAINT "hotel_bookings_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_bookings" ADD CONSTRAINT "car_bookings_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_templates" ADD CONSTRAINT "clause_templates_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_budgetLineItemId_fkey" FOREIGN KEY ("budgetLineItemId") REFERENCES "budget_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_productionCrewId_fkey" FOREIGN KEY ("productionCrewId") REFERENCES "production_crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "project_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_audit_logs" ADD CONSTRAINT "signature_audit_logs_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "project_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_audit_logs" ADD CONSTRAINT "signature_audit_logs_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "contract_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_talent_profiles" ADD CONSTRAINT "global_talent_profiles_laborBodyId_fkey" FOREIGN KEY ("laborBodyId") REFERENCES "labor_bodies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_talent_profiles" ADD CONSTRAINT "global_talent_profiles_representedById_fkey" FOREIGN KEY ("representedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_calls" ADD CONSTRAINT "casting_calls_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_calls" ADD CONSTRAINT "casting_calls_breakdownElementId_fkey" FOREIGN KEY ("breakdownElementId") REFERENCES "breakdown_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_calls" ADD CONSTRAINT "casting_calls_characterProfileId_fkey" FOREIGN KEY ("characterProfileId") REFERENCES "character_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_profiles" ADD CONSTRAINT "character_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_profiles" ADD CONSTRAINT "character_profiles_breakdownElementId_fkey" FOREIGN KEY ("breakdownElementId") REFERENCES "breakdown_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_submissions" ADD CONSTRAINT "casting_submissions_castingCallId_fkey" FOREIGN KEY ("castingCallId") REFERENCES "casting_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_submissions" ADD CONSTRAINT "casting_submissions_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "global_talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_ops_checklists" ADD CONSTRAINT "talent_ops_checklists_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "casting_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_negotiations" ADD CONSTRAINT "talent_negotiations_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "casting_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casting_auditions" ADD CONSTRAINT "casting_auditions_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "casting_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "global_talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_performance_reviews" ADD CONSTRAINT "talent_performance_reviews_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "global_talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_performance_reviews" ADD CONSTRAINT "talent_performance_reviews_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_properties" ADD CONSTRAINT "accommodation_properties_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_inventory" ADD CONSTRAINT "room_inventory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "accommodation_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_assignments" ADD CONSTRAINT "accommodation_assignments_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_assignments" ADD CONSTRAINT "accommodation_assignments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "accommodation_properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_assignments" ADD CONSTRAINT "accommodation_assignments_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_assignments" ADD CONSTRAINT "accommodation_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_assignments" ADD CONSTRAINT "accommodation_assignments_hotelBookingId_fkey" FOREIGN KEY ("hotelBookingId") REFERENCES "hotel_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_vehicles" ADD CONSTRAINT "transport_vehicles_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_vehicles" ADD CONSTRAINT "transport_vehicles_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_vehicles" ADD CONSTRAINT "transport_vehicles_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_vehicles" ADD CONSTRAINT "transport_vehicles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_drivers" ADD CONSTRAINT "transport_drivers_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_drivers" ADD CONSTRAINT "transport_drivers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "transport_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_passengers" ADD CONSTRAINT "transport_passengers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "transport_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_passengers" ADD CONSTRAINT "transport_passengers_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shuttle_routes" ADD CONSTRAINT "shuttle_routes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "production_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shuttle_routes" ADD CONSTRAINT "shuttle_routes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shuttle_routes" ADD CONSTRAINT "shuttle_routes_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "transport_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shuttle_stops" ADD CONSTRAINT "shuttle_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "shuttle_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shuttle_riders" ADD CONSTRAINT "shuttle_riders_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "shuttle_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shuttle_riders" ADD CONSTRAINT "shuttle_riders_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shuttle_riders" ADD CONSTRAINT "shuttle_riders_pickupStopId_fkey" FOREIGN KEY ("pickupStopId") REFERENCES "shuttle_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_representations" ADD CONSTRAINT "talent_representations_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "global_talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_credits" ADD CONSTRAINT "talent_credits_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "global_talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_interactions" ADD CONSTRAINT "talent_interactions_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "global_talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_list_members" ADD CONSTRAINT "talent_list_members_listId_fkey" FOREIGN KEY ("listId") REFERENCES "talent_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_list_members" ADD CONSTRAINT "talent_list_members_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "global_talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audition_packages" ADD CONSTRAINT "audition_packages_castingCallId_fkey" FOREIGN KEY ("castingCallId") REFERENCES "casting_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_tape_submissions" ADD CONSTRAINT "self_tape_submissions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "audition_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_tape_submissions" ADD CONSTRAINT "self_tape_submissions_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "casting_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageVersion" ADD CONSTRAINT "MessageVersion_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PttSession" ADD CONSTRAINT "PttSession_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMinute" ADD CONSTRAINT "MeetingMinute_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceCheckin" ADD CONSTRAINT "GeofenceCheckin_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "GeofencePin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
