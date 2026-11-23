/**
 * Scaled demo seed — ~452 learners across 4 institutions.
 *
 * Uses a deterministic mulberry32 PRNG seeded with a fixed value so the
 * output is identical on every run (idempotent). Never uses real personal
 * data; all names, emails and credentials are fictional.
 *
 * Institutions:
 *   1. Ubuntu Future Secondary School    (ZA / CAPS Gr 9-12)   226 learners
 *   2. Kgalagadi Community Senior School (BW / BGCSE Form 3-5) 162 learners
 *   3. Highveld Independent College      (ZA / IEB Gr 12)       34 learners
 *   4. Limpopo TVET College              (ZA / NATED N4-N5)     24 learners
 *                                                               ─────────
 *                                                         Total: 446 learners
 *
 * Password for every demo account: 12345  (hashed with bcrypt cost 10)
 */

// ---------------------------------------------------------------------------
// PRNG — mulberry32 (deterministic, seeded)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0xcab0_5eed);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rng() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Name pools (fictional)
// ---------------------------------------------------------------------------

const ZA_FIRST = [
  "Amahle","Bongani","Busisiwe","Dikeledi","Dumisani","Fatima","Gcina",
  "Hloni","Khanya","Lerato","Lethiwe","Lwazi","Mandisa","Mpho","Nandi",
  "Nokuthula","Nomsa","Nompumelelo","Nontobeko","Ntombi","Phumzile",
  "Sibusiso","Siphamandla","Siyabonga","Thandeka","Thabo","Tshepiso",
  "Unathi","Vusumuzi","Wandile","Yandisa","Zintle","Zwelakhe","Ayanda",
  "Buhle","Celiwe","Dalisu","Enkosi","Fezile","Gcinile","Hlanganani",
  "Imogen","Jabulile","Khulekani","Lindani","Mlungisi","Nandipha",
  "Olwethu","Phindile","Qhawe","Rethabile","Sandile","Thandolwethu",
  "Ulwazi","Vuyani","Wiseman","Xolani","Yolokazi","Zinokuthula",
];

const BW_FIRST = [
  "Agang","Boago","Bogosi","Bontle","Boitumelo","Dimpho","Ditiro",
  "Gaone","Gorata","Kabelo","Kagiso","Karabo","Katlego","Kefilwe",
  "Kgomotso","Kitso","Legodimo","Lesego","Letlhogonolo","Lorato",
  "Masego","Mmoloki","Mmoni","Moitlheki","Molebogeng","Mothusi",
  "Mpho","Neo","Nkosi","Ntlhang","Oarabile","Olebogeng","Onalerona",
  "Phenyo","Pontsho","Refilwe","Retsang","Sethunya","Sithole",
  "Tebogo","Thabo","Thari","Tirafalo","Tsaone","Tumelo","Warona",
  "Wonga","Xolani","Yrro","Zaone",
];

const ZA_LAST = [
  "Dlamini","Khumalo","Mthembu","Nkosi","Sithole","Zulu","Ndlovu",
  "Mhlongo","Cele","Shabalala","Mthethwa","Khoza","Ntuli","Buthelezi",
  "Mabaso","Molefe","Nxumalo","Dube","Madlala","Majola","Mkhize",
  "Myeni","Nene","Ngema","Ngcobo","Nkululeko","Ntombela","Sibiya",
  "Vilakazi","Xulu","Zwane","Mthetwa","Jiyane","Hlatshwayo","Mthombeni",
  "Phiri","Banda","Mokoena","Modise","Mahlangu","Nkuna","Mashego",
  "Mabunda","Maluleke","Chauke","Khoza","Mthiyane","Luthuli","Majozi",
  "Mncwango","Nxumalo","Shabalala",
];

const BW_LAST = [
  "Moatlhodi","Bogwasi","Ramotse","Tshekedi","Molefhe","Dikgale",
  "Modise","Mmolawa","Kgomotso","Letsebe","Ramotlhwa","Setlhabi",
  "Pheto","Montsho","Garebangwe","Baitshepi","Kekgonne","Nthite",
  "Dikgang","Tlhagane","Sebetlela","Ramosweu","Bogosi","Phuthego",
  "Disang","Molefe","Morake","Nthaga","Sithole","Moffat","Morwesi",
  "Ramatlhodi","Thobega","Nkwe","Thekiso","Baleseng","Rampedi",
];

// ---------------------------------------------------------------------------
// Subject pools by curriculum
// ---------------------------------------------------------------------------

const SUBJECTS_CAPS_GR9_10 = [
  "Mathematics","Mathematical Literacy","English Home Language",
  "Afrikaans First Additional Language","isiZulu First Additional Language",
  "Life Sciences","Physical Sciences","Geography","History","Accounting",
  "Economics","Business Studies","Life Orientation","Tourism",
  "Agricultural Sciences","Consumer Studies","Visual Arts","Music",
  "Dramatic Arts","Information Technology","Computer Applications Technology",
];

const SUBJECTS_CAPS_GR11_12 = [
  "Mathematics","Mathematical Literacy","English Home Language",
  "Afrikaans First Additional Language","isiZulu First Additional Language",
  "Life Sciences","Physical Sciences","Chemistry","Geography","History",
  "Accounting","Economics","Business Studies","Life Orientation",
  "Tourism","Agricultural Sciences","Information Technology",
  "Computer Applications Technology","Engineering Graphics and Design",
  "Electrical Technology","Civil Technology","Mechanical Technology",
];

const SUBJECTS_BGCSE = [
  "English Language","Setswana","Mathematics","Science","Agriculture",
  "Business Studies","Accounting","Economics","History","Geography",
  "Biology","Chemistry","Physics","Computer Studies","Home Economics",
  "Design and Technology","Art and Design","French","Physical Education",
];

const SUBJECTS_IEB = [
  "Mathematics","English Home Language","Afrikaans Second Language",
  "Life Sciences","Physical Sciences","Accounting","Business Studies",
  "Economics","History","Geography","Information Technology",
  "Life Orientation","Visual Arts","Drama","Music",
];

const SUBJECTS_NATED = [
  "Engineering Science N4","Mathematics N4","Engineering Drawing N4",
  "Industrial Electronics N4","Mechanotechnology N4",
  "Electrotechnology N4","Motor Trade Theory N4",
  "Engineering Science N5","Mathematics N5","Engineering Drawing N5",
  "Industrial Electronics N5","Mechanotechnology N5",
  "Electrotechnology N5","Motor Trade Theory N5",
  "Supervisory Management N5","Communication N4","Communication N5",
];

// ---------------------------------------------------------------------------
// Explanation styles / interests / goals
// ---------------------------------------------------------------------------

const EXPLANATION_STYLES = [
  "step_by_step","examples_first","concise","practice_first","visual",
] as const;

const INTERESTS_POOL = [
  "football","music","coding","cooking","fashion","gaming","reading",
  "science","mathematics","history","art","photography","dance",
  "entrepreneurship","agriculture","environmental science","travel",
  "social media","drama","film","robotics","data science","healthcare",
  "architecture","law","psychology","economics","politics",
];

const GOALS_POOL = [
  "pass matric","get a university bursary","become an engineer",
  "study medicine","start a business","improve mathematics",
  "learn to code","get distinctions","pass BGCSE with merit",
  "get into NWU","study at UJ","qualify for a bursary",
  "complete N6","find a job after TVET","become a nurse",
  "study at UP","pass with 70%+","get a distinction in Maths",
];

const LANGUAGES = [
  "en","zu","xh","st","tn","ss","ve","ts","nr","af",
  "tn","st","en", // Setswana/Sesotho more common in BW seeds
];

// ---------------------------------------------------------------------------
// Institution definitions
// ---------------------------------------------------------------------------

export interface DemoInstitution {
  id: number;
  name: string;
  country: "ZA" | "BW";
  curriculum: string;
  grades: string[];
  targetCount: number;
}

export const DEMO_INSTITUTIONS: DemoInstitution[] = [
  {
    id: 1,
    name: "Ubuntu Future Secondary School",
    country: "ZA",
    curriculum: "CAPS",
    grades: ["Grade 9","Grade 10","Grade 11","Grade 12"],
    targetCount: 226,
  },
  {
    id: 2,
    name: "Kgalagadi Community Senior School",
    country: "BW",
    curriculum: "BGCSE",
    grades: ["Form 3","Form 4","Form 5"],
    targetCount: 162,
  },
  {
    id: 3,
    name: "Highveld Independent College",
    country: "ZA",
    curriculum: "IEB",
    grades: ["Grade 12"],
    targetCount: 34,
  },
  {
    id: 4,
    name: "Limpopo Technical & Vocational Education College",
    country: "ZA",
    curriculum: "NATED",
    grades: ["N4","N5"],
    targetCount: 24,
  },
];

// ---------------------------------------------------------------------------
// Learner record type
// ---------------------------------------------------------------------------

export interface DemoLearner {
  /** Deterministic slug — usable as a stable local ID. */
  slug: string;
  institutionId: number;
  firstName: string;
  lastName: string;
  /** Fictional email — safe to log. */
  email: string;
  /** Plain-text demo password — hash with bcrypt(10) on insert. */
  password: "12345";
  grade: string;
  curriculum: string;
  country: "ZA" | "BW";
  subjects: string[];
  explanationStyle: (typeof EXPLANATION_STYLES)[number];
  interests: string[];
  goals: string[];
  languagePreference: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

function subjectsForInstitution(
  inst: DemoInstitution,
  grade: string,
): string[] {
  let pool: string[];
  if (inst.curriculum === "CAPS") {
    pool =
      grade === "Grade 9" || grade === "Grade 10"
        ? SUBJECTS_CAPS_GR9_10
        : SUBJECTS_CAPS_GR11_12;
  } else if (inst.curriculum === "BGCSE") {
    pool = SUBJECTS_BGCSE;
  } else if (inst.curriculum === "IEB") {
    pool = SUBJECTS_IEB;
  } else {
    pool = SUBJECTS_NATED;
  }
  const count = 4 + Math.floor(rng() * 4); // 4–7 subjects
  return pickN(pool, count);
}

/**
 * Generates the full set of demo learner records.
 * Calling this twice with the same PRNG seed produces identical output.
 */
export function generateDemoLearners(): DemoLearner[] {
  const learners: DemoLearner[] = [];

  for (const inst of DEMO_INSTITUTIONS) {
    const firstPool = inst.country === "BW" ? BW_FIRST : ZA_FIRST;
    const lastPool = inst.country === "BW" ? BW_LAST : ZA_LAST;

    for (let i = 0; i < inst.targetCount; i++) {
      const firstName = pick(firstPool);
      const lastName = pick(lastPool);
      const grade = pick(inst.grades);
      const slug = `inst${inst.id}-learner-${String(i + 1).padStart(3, "0")}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@demo.cabo.education`;

      learners.push({
        slug,
        institutionId: inst.id,
        firstName,
        lastName,
        email,
        password: "12345",
        grade,
        curriculum: inst.curriculum,
        country: inst.country,
        subjects: subjectsForInstitution(inst, grade),
        explanationStyle: pick([...EXPLANATION_STYLES]),
        interests: pickN(INTERESTS_POOL, 2 + Math.floor(rng() * 4)),
        goals: pickN(GOALS_POOL, 1 + Math.floor(rng() * 3)),
        languagePreference: pick(
          inst.country === "BW"
            ? ["en", "tn", "st"]
            : ["en", "zu", "xh", "st", "af", "tn"],
        ),
      });
    }
  }

  return learners;
}
