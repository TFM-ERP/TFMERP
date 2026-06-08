// Film crew taxonomy — Department → Roles. Reference data for cascading pickers.
// See docs/film-crew-taxonomy.md. "Other" is appended automatically by the picker.

export interface CrewDept { department: string; roles: string[] }

export const FILM_CREW: CrewDept[] = [
  // ── Above the line ──
  { department: 'Production (Producers)', roles: ['Executive Producer', 'Co-Executive Producer', 'Producer', 'Co-Producer', 'Associate Producer', 'Line Producer', 'Production Executive'] },
  { department: 'Direction', roles: ['Director', 'Co-Director', '2nd Unit Director', "Director's Assistant"] },
  { department: 'Writing', roles: ['Writer', 'Screenwriter', 'Staff Writer', 'Story Editor', 'Script Editor'] },
  { department: 'Casting', roles: ['Casting Director', 'Casting Associate', 'Casting Assistant', 'Extras/Background Casting'] },
  // ── Production / management ──
  { department: 'Production Office', roles: ['Unit Production Manager (UPM)', 'Production Supervisor', 'Production Coordinator', 'Assistant Production Coordinator (APOC)', 'Production Secretary', 'Office Production Assistant', 'Travel Coordinator'] },
  { department: 'Assistant Directors', roles: ['1st Assistant Director', '2nd Assistant Director', '2nd 2nd AD', '3rd Assistant Director', 'Additional AD', 'Set PA', 'Floor Runner'] },
  { department: 'Script / Continuity', roles: ['Script Supervisor'] },
  { department: 'Accounting', roles: ['Production Accountant', '1st Assistant Accountant', '2nd Assistant Accountant', 'Payroll Accountant', 'Accounts Clerk', 'Post-Production Accountant'] },
  // ── Camera & lighting ──
  { department: 'Camera', roles: ['Director of Photography (DP)', 'Camera Operator', 'A-Camera Operator', 'B-Camera Operator', 'Steadicam Operator', '1st AC (Focus Puller)', '2nd AC (Clapper Loader)', 'Camera Loader', 'DIT', 'Data Wrangler', 'Camera Trainee', 'Camera PA', 'Drone Operator', 'Gimbal Technician', 'Underwater Camera Operator', 'Video Assist Operator', 'Stills Photographer'] },
  { department: 'Grip', roles: ['Key Grip', 'Best Boy Grip', 'Dolly Grip', 'Grip', 'Rigging Grip', 'Crane/Technocrane Operator', 'Grip Trainee'] },
  { department: 'Electric / Lighting', roles: ['Gaffer (Chief Lighting Technician)', 'Best Boy Electric', 'Electrician/Lighting Technician', 'Lamp Operator', 'Generator Operator', 'Rigging Gaffer', 'Board/Console Operator', 'Electrical Trainee'] },
  // ── Sound ──
  { department: 'Sound (Production)', roles: ['Production Sound Mixer', 'Boom Operator', 'Sound Assistant / Cable Person', 'Utility Sound Technician'] },
  // ── Art ──
  { department: 'Art Department', roles: ['Production Designer', 'Supervising Art Director', 'Art Director', 'Assistant Art Director', 'Set Designer', 'Draughtsperson', 'Concept Artist', 'Storyboard Artist', 'Graphic Designer', 'Art Department Coordinator', 'Art Department Assistant'] },
  { department: 'Set Decoration', roles: ['Set Decorator', 'Assistant Set Decorator', 'Leadman', 'Set Dresser', 'On-Set Dresser', 'Standby Set Dresser', 'Buyer'] },
  { department: 'Props', roles: ['Property Master', 'Assistant Property Master', 'Standby Props', 'Dressing Props', 'Props Maker', 'Armourer'] },
  { department: 'Construction', roles: ['Construction Manager', 'Construction Coordinator', 'Head Carpenter', 'Carpenter', 'Scenic Artist', 'Painter', 'Plasterer', 'Sculptor', 'Welder', 'Rigger', 'Stagehand'] },
  { department: 'Greens', roles: ['Greens Supervisor', 'Greensman', 'Greens Assistant'] },
  // ── Costume & makeup ──
  { department: 'Costume / Wardrobe', roles: ['Costume Designer', 'Assistant Costume Designer', 'Costume Supervisor', 'Key Costumer', 'Set Costumer', 'Wardrobe Assistant', 'Cutter/Maker', 'Seamstress/Tailor', 'Ager/Dyer', 'Buyer'] },
  { department: 'Hair & Makeup', roles: ['Hair & Makeup Designer', 'Key Makeup Artist', 'Makeup Artist', 'Key Hair Stylist', 'Hair Stylist', 'SFX/Prosthetics Makeup Artist', 'Prosthetics Technician', 'Daily Hair/Makeup Artist'] },
  // ── Effects & stunts ──
  { department: 'Special Effects (SFX)', roles: ['SFX Supervisor', 'SFX Coordinator', 'SFX Technician', 'Pyrotechnician', 'Model Maker'] },
  { department: 'Visual Effects (VFX)', roles: ['VFX Supervisor', 'VFX Producer', 'On-Set VFX Supervisor', 'VFX Coordinator', 'VFX Data Wrangler', 'Matchmove Artist', 'Compositor', 'CG Artist', 'Roto/Paint Artist', 'Motion Capture Technician'] },
  { department: 'Stunts', roles: ['Stunt Coordinator', 'Assistant Stunt Coordinator', 'Stunt Performer', 'Stunt Double', 'Stunt Rigger', 'Fight Choreographer', 'Precision Driver'] },
  // ── Locations & logistics ──
  { department: 'Locations', roles: ['Location Manager', 'Assistant Location Manager', 'Location Scout', 'Unit Manager', 'Location Assistant', 'Location Marshal', 'Parking Coordinator'] },
  { department: 'Transportation', roles: ['Transportation Coordinator', 'Transportation Captain', 'Driver', 'Picture Car Coordinator', 'Picture Car Wrangler'] },
  { department: 'Catering / Craft Service', roles: ['Caterer', 'Chef', 'Catering Assistant', 'Craft Service'] },
  { department: 'Background / Extras', roles: ['Extras Casting Director', 'Background Coordinator', 'Extras Wrangler'] },
  // ── On-set support ──
  { department: 'Health & Safety / Medical', roles: ['Set Medic', 'Health & Safety Advisor', 'COVID/Compliance Officer', 'Intimacy Coordinator', 'Safety Officer'] },
  { department: 'Coaching', roles: ['Dialect/Dialogue Coach', 'Acting Coach', 'Movement Coach', 'Choreographer'] },
  { department: 'Animals', roles: ['Animal Coordinator', 'Animal Wrangler', 'Animal Trainer', 'Veterinarian'] },
  { department: 'Marine / Aerial / Specialty', roles: ['Marine Coordinator', 'Aerial Coordinator', 'Pilot', 'Safety Diver'] },
  { department: 'Publicity / Stills', roles: ['Unit Publicist', 'Stills Photographer', 'EPK Crew', 'Behind-the-Scenes Videographer', 'Social Media Manager'] },
  { department: 'Security', roles: ['Security Coordinator', 'Security Guard', 'Site Security'] },
  // ── Post-production ──
  { department: 'Editorial', roles: ['Post-Production Supervisor', 'Editor', 'Co-Editor', 'Additional Editor', '1st Assistant Editor', '2nd Assistant Editor', 'VFX Editor', 'Online/Conform Editor', 'DI Producer'] },
  { department: 'Colour / DI', roles: ['Colorist', 'Dailies Colorist', 'Dailies Operator'] },
  { department: 'Sound Post', roles: ['Supervising Sound Editor', 'Sound Designer', 'Dialogue Editor', 'ADR Editor', 'Foley Artist', 'Foley Editor', 'Sound Effects Editor', 'Re-Recording Mixer', 'Music Editor'] },
  { department: 'Music', roles: ['Composer', 'Music Supervisor', 'Orchestrator', 'Conductor', 'Score Mixer', 'Music Producer'] },
  // ── Cast (not a crew dept, but used in directory) ──
  { department: 'Cast / Talent', roles: ['Lead Cast', 'Supporting Cast', 'Day Player', 'Background / Extra', 'Stand-In', 'Body Double', 'Voice Artist'] },
  { department: 'Other', roles: [] },
];

export const FILM_DEPARTMENTS = FILM_CREW.map((d) => d.department);
export const rolesFor = (department?: string): string[] => FILM_CREW.find((d) => d.department === department)?.roles || [];

// Industry tiering: which departments are Above-the-Line, Post, or Below-the-Line (default).
const ATL_DEPARTMENTS = new Set(['Production (Producers)', 'Direction', 'Writing', 'Casting']);
const POST_DEPARTMENTS = new Set(['Editorial', 'Colour / DI', 'Sound Post', 'Music']);
export const tierForDepartment = (department?: string): 'ATL' | 'BTL' | 'POST' => {
  if (department && ATL_DEPARTMENTS.has(department)) return 'ATL';
  if (department && POST_DEPARTMENTS.has(department)) return 'POST';
  return 'BTL';
};
