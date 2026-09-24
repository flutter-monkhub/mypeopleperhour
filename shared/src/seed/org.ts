// Organisation seed: units, functions and a ~260 person PCBL-style hierarchy.
// All names are fictional. Fixed "demo" people match the sample snapshots in the deck.

import type { Employee, EmployeeLevel, FunctionArea, Gender, Unit } from '../types';
import { createRng, int, pick, type Rng } from '../utils/random';

export const UNITS: Unit[] = [
  { id: 'U-CORP', name: 'Corporate Office', shortName: 'Corporate', location: 'Kolkata' },
  { id: 'U-DGP', name: 'Durgapur Plant', shortName: 'Durgapur', location: 'Durgapur' },
  { id: 'U-PLJ', name: 'Palej Plant', shortName: 'Palej', location: 'Palej' },
  { id: 'U-MDR', name: 'Mundra Plant', shortName: 'Mundra', location: 'Mundra' },
  { id: 'U-KCH', name: 'Kochi Plant', shortName: 'Kochi', location: 'Kochi' },
  { id: 'U-CHN', name: 'Chennai Plant', shortName: 'Chennai', location: 'Chennai' },
  { id: 'U-SLS', name: 'Regional Sales', shortName: 'Sales', location: 'Mumbai' },
];

export const FUNCTIONS: FunctionArea[] = [
  { id: 'F-EXE', name: 'Executive Office', departments: ['Office of the MD'] },
  { id: 'F-MFG', name: 'Manufacturing', departments: ['Production', 'Maintenance', 'Process Engineering', 'Quality Assurance', 'EHS', 'Operational Excellence'] },
  { id: 'F-COM', name: 'Commercial', departments: ['Domestic Sales', 'Exports', 'Marketing', 'Customer Technical Services'] },
  { id: 'F-SCM', name: 'Supply Chain', departments: ['Procurement', 'Logistics', 'Planning'] },
  { id: 'F-FIN', name: 'Finance', departments: ['Finance & Accounts', 'Treasury', 'Taxation'] },
  { id: 'F-HR', name: 'Human Resources', departments: ['HR Operations', 'Talent & L&D'] },
  { id: 'F-DIG', name: 'Technology & Digital', departments: ['Analytics', 'Insights', 'IT Infrastructure', 'Digital Transformation'] },
  { id: 'F-RND', name: 'R&D & Innovation', departments: ['Research & Development', 'Application Development'] },
];

export const GRADES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'];

export const LOCATIONS = ['Kolkata', 'Durgapur', 'Palej', 'Mundra', 'Kochi', 'Chennai', 'Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Gurgaon'];

const FEMALE = [
  'Aditi', 'Ananya', 'Bhavna', 'Deepika', 'Divya', 'Farah', 'Gauri', 'Ishita', 'Jaya', 'Kavya', 'Kritika', 'Lakshmi',
  'Madhuri', 'Megha', 'Nisha', 'Pallavi', 'Payal', 'Radhika', 'Rashmi', 'Ritu', 'Sakshi', 'Shreya', 'Sneha', 'Swati',
  'Tanvi', 'Trisha', 'Vandana', 'Yamini', 'Zoya', 'Aparna', 'Chitra', 'Harini', 'Ira', 'Mitali', 'Nandita', 'Sanjana',
];
const MALE = [
  'Abhinav', 'Aditya', 'Akash', 'Aman', 'Anirban', 'Ankit', 'Ashish', 'Deepak', 'Dev', 'Gautam', 'Harsh', 'Imran',
  'Kunal', 'Manish', 'Mohit', 'Naveen', 'Nikhil', 'Pranav', 'Rahul', 'Rajat', 'Rohit', 'Sagar', 'Saurabh', 'Siddharth',
  'Sourav', 'Sumit', 'Tarun', 'Uday', 'Varun', 'Yash', 'Arnab', 'Chetan', 'Gopal', 'Jatin', 'Lalit', 'Prakash',
];
const LAST = [
  'Agarwal', 'Banerjee', 'Basu', 'Bhat', 'Chakraborty', 'Das', 'Dasgupta', 'Dutta', 'Ghosh', 'Gupta', 'Hegde', 'Jain',
  'Joshi', 'Kamath', 'Khan', 'Kumar', 'Mishra', 'Mukherjee', 'Nair', 'Pandey', 'Patil', 'Pillai', 'Rao', 'Reddy',
  'Roy', 'Saha', 'Sarkar', 'Shah', 'Sharma', 'Shetty', 'Sinha', 'Srinivasan', 'Thakur', 'Trivedi', 'Varma', 'Yadav',
];

const SALES_LOCATIONS = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Gurgaon', 'Kolkata', 'Chennai'];
const DIGITAL_LOCATIONS = ['Mumbai', 'Bangalore', 'Pune', 'Delhi', 'Gurgaon', 'Kolkata'];

/** Titles for individual contributors by function and grade (G1–G4). */
const IC_TITLES: Record<string, string[]> = {
  'F-MFG': ['Graduate Engineer Trainee', 'Engineer', 'Senior Engineer', 'Assistant Manager'],
  'F-COM': ['Sales Trainee', 'Sales Executive', 'Senior Sales Executive', 'Assistant Manager – Sales'],
  'F-SCM': ['Executive', 'Executive', 'Senior Executive', 'Assistant Manager'],
  'F-FIN': ['Associate', 'Accounts Executive', 'Senior Financial Analyst', 'Assistant Manager – Finance'],
  'F-HR': ['HR Associate', 'HR Executive', 'Senior HR Executive', 'Assistant Manager – HR'],
  'F-DIG': ['Associate', 'Analyst', 'Senior Analyst', 'Consultant'],
  'F-RND': ['Research Associate', 'Scientist', 'Senior Scientist', 'Principal Scientist'],
};

interface FixedPerson {
  code: string;
  first: string;
  last: string;
  gender: Gender;
  designation: string;
  department: string;
  functionId: string;
  grade: string;
  unitId: string;
  location: string;
  manager: string | null; // code
  doj: string; // yyyy-mm-dd
}

// Executive + senior leadership team (fixed so demos are stable).
const FIXED: FixedPerson[] = [
  { code: 'E00001', first: 'Arvind', last: 'Sen', gender: 'male', designation: 'Managing Director & CEO', department: 'Office of the MD', functionId: 'F-EXE', grade: 'G10', unitId: 'U-CORP', location: 'Kolkata', manager: null, doj: '2009-06-01' },

  // L1 — CXOs
  { code: 'E00002', first: 'Rakesh', last: 'Agarwal', gender: 'male', designation: 'Chief Operating Officer', department: 'Operational Excellence', functionId: 'F-MFG', grade: 'G9', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00001', doj: '2011-04-11' },
  { code: 'E00003', first: 'Sunita', last: 'Bhattacharya', gender: 'female', designation: 'Chief Financial Officer', department: 'Finance & Accounts', functionId: 'F-FIN', grade: 'G9', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00001', doj: '2013-09-02' },
  { code: 'E00004', first: 'Nandini', last: 'Rao', gender: 'female', designation: 'Chief Human Resources Officer', department: 'HR Operations', functionId: 'F-HR', grade: 'G9', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00001', doj: '2015-01-05' },
  { code: 'E00005', first: 'Vikrant', last: 'Chopra', gender: 'male', designation: 'Chief Commercial Officer', department: 'Domestic Sales', functionId: 'F-COM', grade: 'G9', unitId: 'U-SLS', location: 'Mumbai', manager: 'E00001', doj: '2012-07-16' },
  { code: 'E00006', first: 'Vivek', last: 'Malhotra', gender: 'male', designation: 'Chief Digital & Information Officer', department: 'Digital Transformation', functionId: 'F-DIG', grade: 'G9', unitId: 'U-CORP', location: 'Mumbai', manager: 'E00001', doj: '2018-03-19' },
  { code: 'E00007', first: 'Ramesh', last: 'Iyer', gender: 'male', designation: 'Head – R&D & Innovation', department: 'Research & Development', functionId: 'F-RND', grade: 'G9', unitId: 'U-PLJ', location: 'Palej', manager: 'E00001', doj: '2010-11-22' },
  { code: 'E00008', first: 'Harish', last: 'Kulkarni', gender: 'male', designation: 'Head – Supply Chain', department: 'Planning', functionId: 'F-SCM', grade: 'G9', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00001', doj: '2014-02-10' },

  // L2 — senior leaders (the mentor pool)
  { code: 'E00010', first: 'Subrata', last: 'Ghosh', gender: 'male', designation: 'Plant Head – Durgapur', department: 'Production', functionId: 'F-MFG', grade: 'G8', unitId: 'U-DGP', location: 'Durgapur', manager: 'E00002', doj: '2008-05-12' },
  { code: 'E00011', first: 'Jignesh', last: 'Patel', gender: 'male', designation: 'Plant Head – Palej', department: 'Production', functionId: 'F-MFG', grade: 'G8', unitId: 'U-PLJ', location: 'Palej', manager: 'E00002', doj: '2012-08-20' },
  { code: 'E00012', first: 'Hitesh', last: 'Shah', gender: 'male', designation: 'Plant Head – Mundra', department: 'Production', functionId: 'F-MFG', grade: 'G8', unitId: 'U-MDR', location: 'Mundra', manager: 'E00002', doj: '2016-01-04' },
  { code: 'E00013', first: 'Thomas', last: 'Kurian', gender: 'male', designation: 'Plant Head – Kochi', department: 'Production', functionId: 'F-MFG', grade: 'G8', unitId: 'U-KCH', location: 'Kochi', manager: 'E00002', doj: '2014-10-13' },
  { code: 'E00014', first: 'Karthik', last: 'Subramanian', gender: 'male', designation: 'Plant Head – Chennai', department: 'Production', functionId: 'F-MFG', grade: 'G8', unitId: 'U-CHN', location: 'Chennai', manager: 'E00002', doj: '2019-06-17' },
  { code: 'E00015', first: 'Anjali', last: 'Deshmukh', gender: 'female', designation: 'VP – Manufacturing Excellence', department: 'Operational Excellence', functionId: 'F-MFG', grade: 'G8', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00002', doj: '2013-03-25' },
  { code: 'E00016', first: 'Manoj', last: 'Tiwari', gender: 'male', designation: 'Head – EHS', department: 'EHS', functionId: 'F-MFG', grade: 'G7', unitId: 'U-DGP', location: 'Durgapur', manager: 'E00002', doj: '2015-07-06' },
  { code: 'E00017', first: 'Rekha', last: 'Agarwal', gender: 'female', designation: 'Financial Controller', department: 'Finance & Accounts', functionId: 'F-FIN', grade: 'G8', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00003', doj: '2016-04-18' },
  { code: 'E00018', first: 'Amit', last: 'Jain', gender: 'male', designation: 'Head – Treasury & Taxation', department: 'Treasury', functionId: 'F-FIN', grade: 'G7', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00003', doj: '2017-12-04' },
  { code: 'E00019', first: 'Kavita', last: 'Menon', gender: 'female', designation: 'Head – Talent & L&D', department: 'Talent & L&D', functionId: 'F-HR', grade: 'G7', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00004', doj: '2018-08-01' },
  { code: 'E00020', first: 'Arindam', last: 'Chatterjee', gender: 'male', designation: 'Head – HR Operations', department: 'HR Operations', functionId: 'F-HR', grade: 'G7', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00004', doj: '2014-05-26' },
  { code: 'E00021', first: 'Rahul', last: 'Verma', gender: 'male', designation: 'Head – Domestic Sales', department: 'Domestic Sales', functionId: 'F-COM', grade: 'G8', unitId: 'U-SLS', location: 'Mumbai', manager: 'E00005', doj: '2013-01-14' },
  { code: 'E00022', first: 'Farhan', last: 'Qureshi', gender: 'male', designation: 'Head – Exports', department: 'Exports', functionId: 'F-COM', grade: 'G8', unitId: 'U-SLS', location: 'Mumbai', manager: 'E00005', doj: '2015-09-28' },
  { code: 'E00023', first: 'Shalini', last: 'Gupta', gender: 'female', designation: 'Head – Marketing', department: 'Marketing', functionId: 'F-COM', grade: 'G7', unitId: 'U-SLS', location: 'Mumbai', manager: 'E00005', doj: '2019-02-11' },
  { code: 'E00024', first: 'Suresh', last: 'Pillai', gender: 'male', designation: 'Head – IT Infrastructure', department: 'IT Infrastructure', functionId: 'F-DIG', grade: 'G7', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00006', doj: '2016-06-06' },
  { code: 'E00025', first: 'Meenakshi', last: 'Rao', gender: 'female', designation: 'Principal Scientist', department: 'Research & Development', functionId: 'F-RND', grade: 'G8', unitId: 'U-PLJ', location: 'Palej', manager: 'E00007', doj: '2012-03-05' },
  { code: 'E00026', first: 'Abhishek', last: 'Banerjee', gender: 'male', designation: 'Head – Application Development', department: 'Application Development', functionId: 'F-RND', grade: 'G7', unitId: 'U-PLJ', location: 'Palej', manager: 'E00007', doj: '2017-10-09' },
  { code: 'E00027', first: 'Nitin', last: 'Saxena', gender: 'male', designation: 'Head – Procurement', department: 'Procurement', functionId: 'F-SCM', grade: 'G7', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00008', doj: '2016-11-21' },
  { code: 'E00028', first: 'Gaurav', last: 'Bose', gender: 'male', designation: 'Head – Logistics', department: 'Logistics', functionId: 'F-SCM', grade: 'G7', unitId: 'U-CORP', location: 'Kolkata', manager: 'E00008', doj: '2018-01-15' },
  { code: 'E00029', first: 'Priyanka', last: 'Sethi', gender: 'female', designation: 'Head – Customer Technical Services', department: 'Customer Technical Services', functionId: 'F-COM', grade: 'G7', unitId: 'U-SLS', location: 'Mumbai', manager: 'E00005', doj: '2017-05-08' },
  { code: 'E00030', first: 'Sandeep', last: 'Mahajan', gender: 'male', designation: 'Head – Quality Assurance', department: 'Quality Assurance', functionId: 'F-MFG', grade: 'G7', unitId: 'U-PLJ', location: 'Palej', manager: 'E00002', doj: '2015-03-02' },

  // L3 — fixed demo managers
  { code: 'E00112', first: 'Priya', last: 'Mehta', gender: 'female', designation: 'Manager – Analytics & Insights', department: 'Analytics', functionId: 'F-DIG', grade: 'G5', unitId: 'U-CORP', location: 'Mumbai', manager: 'E00006', doj: '2019-07-01' },
  { code: 'E00150', first: 'Sameer', last: 'Joshi', gender: 'male', designation: 'HR Business Partner – Durgapur', department: 'HR Operations', functionId: 'F-HR', grade: 'G6', unitId: 'U-DGP', location: 'Durgapur', manager: 'E00020', doj: '2017-02-13' },

  // Priya Mehta's direct reports (exactly as in the sample manager dashboard)
  { code: 'E00123', first: 'Aarav', last: 'Sharma', gender: 'male', designation: 'Senior Analyst', department: 'Analytics', functionId: 'F-DIG', grade: 'G3', unitId: 'U-CORP', location: 'Mumbai', manager: 'E00112', doj: '2021-08-09' },
  { code: 'E00125', first: 'Riya', last: 'Das', gender: 'female', designation: 'Associate', department: 'Analytics', functionId: 'F-DIG', grade: 'G2', unitId: 'U-CORP', location: 'Bangalore', manager: 'E00112', doj: '2023-06-12' },
  { code: 'E00127', first: 'Sanjay', last: 'Menon', gender: 'male', designation: 'Consultant', department: 'Insights', functionId: 'F-DIG', grade: 'G3', unitId: 'U-CORP', location: 'Pune', manager: 'E00112', doj: '2020-11-02' },
  { code: 'E00131', first: 'Meera', last: 'Iyer', gender: 'female', designation: 'Analyst', department: 'Analytics', functionId: 'F-DIG', grade: 'G2', unitId: 'U-CORP', location: 'Mumbai', manager: 'E00112', doj: '2022-04-18' },
  { code: 'E00133', first: 'Vikram', last: 'Patel', gender: 'male', designation: 'Senior Analyst', department: 'Insights', functionId: 'F-DIG', grade: 'G3', unitId: 'U-CORP', location: 'Bangalore', manager: 'E00112', doj: '2021-01-25' },
  { code: 'E00135', first: 'Neha', last: 'Kapoor', gender: 'female', designation: 'Analyst', department: 'Analytics', functionId: 'F-DIG', grade: 'G2', unitId: 'U-CORP', location: 'Delhi', manager: 'E00112', doj: '2022-09-05' },
  { code: 'E00136', first: 'Arjun', last: 'Nair', gender: 'male', designation: 'Associate', department: 'Insights', functionId: 'F-DIG', grade: 'G2', unitId: 'U-CORP', location: 'Mumbai', manager: 'E00112', doj: '2023-02-20' },
  { code: 'E00138', first: 'Pooja', last: 'Singh', gender: 'female', designation: 'Consultant', department: 'Analytics', functionId: 'F-DIG', grade: 'G3', unitId: 'U-CORP', location: 'Bangalore', manager: 'E00112', doj: '2020-06-15' },
  { code: 'E00139', first: 'Karan', last: 'Malhotra', gender: 'male', designation: 'Analyst', department: 'Insights', functionId: 'F-DIG', grade: 'G2', unitId: 'U-CORP', location: 'Gurgaon', manager: 'E00112', doj: '2022-12-12' },
];

/** Codes for the four demo personas used by the mobile app. */
export const DEMO = {
  employee: 'E00125', // Riya Das
  manager: 'E00112', // Priya Mehta
  mentor: 'E00015', // Anjali Deshmukh
  mentee: 'E00123', // Aarav Sharma
  ceo: 'E00001',
  chro: 'E00004',
  coo: 'E00002',
  talentHead: 'E00019',
  hrbpDurgapur: 'E00150',
} as const;

/** Plan of generated L3 managers under each L2 leader: [department, count]. */
const TEAM_PLAN: Record<string, [string, number][]> = {
  E00010: [['Production', 2], ['Maintenance', 1], ['Quality Assurance', 1]],
  E00011: [['Production', 1], ['Maintenance', 1]],
  E00012: [['Production', 1], ['Maintenance', 1]],
  E00013: [['Production', 1], ['Quality Assurance', 1]],
  E00014: [['Production', 1]],
  E00015: [['Operational Excellence', 1], ['Process Engineering', 1]],
  E00016: [['EHS', 1]],
  E00017: [['Finance & Accounts', 2]],
  E00018: [['Taxation', 1]],
  E00019: [['Talent & L&D', 1]],
  E00020: [['HR Operations', 1]], // + Sameer Joshi (fixed)
  E00021: [['Domestic Sales', 3]],
  E00022: [['Exports', 1]],
  E00023: [['Marketing', 1]],
  E00024: [['IT Infrastructure', 1]],
  E00006: [['Digital Transformation', 1]], // + Priya Mehta (fixed)
  E00025: [['Research & Development', 1]],
  E00026: [['Application Development', 1]],
  E00027: [['Procurement', 1]],
  E00028: [['Logistics', 1]],
  E00029: [['Customer Technical Services', 1]],
  E00030: [['Quality Assurance', 1]],
};

const levelForGrade = (grade: string): EmployeeLevel => {
  const g = Number(grade.slice(1));
  if (g >= 9) return 'executive';
  if (g >= 7) return 'senior_leader';
  if (g >= 5) return 'manager';
  return 'staff';
};

const emailFor = (first: string, last: string, taken: Set<string>): string => {
  let base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
  let email = `${base}@pcbl.demo`;
  let n = 2;
  while (taken.has(email)) {
    email = `${base}${n}@pcbl.demo`;
    n++;
  }
  taken.add(email);
  return email;
};

const phoneFor = (rng: Rng) => `+91 ${int(rng, 70000, 99999)} ${int(rng, 10000, 99999)}`;

export function generateEmployees(): Employee[] {
  const rng = createRng(20260401);
  const emails = new Set<string>();
  const usedNames = new Set<string>();
  const employees: Employee[] = [];

  const make = (p: FixedPerson): Employee => {
    usedNames.add(`${p.first} ${p.last}`);
    return {
      id: p.code,
      code: p.code,
      firstName: p.first,
      lastName: p.last,
      name: `${p.first} ${p.last}`,
      email: emailFor(p.first, p.last, emails),
      phone: phoneFor(rng),
      gender: p.gender,
      designation: p.designation,
      department: p.department,
      functionId: p.functionId,
      grade: p.grade,
      level: levelForGrade(p.grade),
      unitId: p.unitId,
      location: p.location,
      managerId: p.manager,
      dateOfJoining: new Date(`${p.doj}T09:00:00`).toISOString(),
      status: 'active',
    };
  };

  FIXED.forEach((p) => employees.push(make(p)));

  let seq = 200;
  const nextCode = () => `E00${seq++}`;
  const randomPerson = (): { first: string; last: string; gender: Gender } => {
    for (;;) {
      const gender: Gender = rng() < 0.42 ? 'female' : 'male';
      const first = pick(rng, gender === 'female' ? FEMALE : MALE);
      const last = pick(rng, LAST);
      const full = `${first} ${last}`;
      if (!usedNames.has(full)) {
        usedNames.add(full);
        return { first, last, gender };
      }
    }
  };
  const randomDoj = (minYear: number, maxYear: number) => {
    const y = int(rng, minYear, maxYear);
    const m = int(rng, 1, 12);
    const d = int(rng, 1, 28);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const byCode = new Map(employees.map((e) => [e.code, e]));

  const staffLocation = (leader: Employee, functionId: string) => {
    if (functionId === 'F-COM' && leader.unitId === 'U-SLS') return pick(rng, SALES_LOCATIONS);
    if (functionId === 'F-DIG') return pick(rng, DIGITAL_LOCATIONS);
    return leader.location;
  };

  const addStaff = (manager: Employee, count: number) => {
    for (let i = 0; i < count; i++) {
      const p = randomPerson();
      const gradeNum = int(rng, 1, 4);
      const titles = IC_TITLES[manager.functionId] ?? IC_TITLES['F-SCM'];
      const location = staffLocation(manager, manager.functionId);
      employees.push(
        make({
          code: nextCode(),
          first: p.first,
          last: p.last,
          gender: p.gender,
          designation: titles[gradeNum - 1],
          department: manager.department,
          functionId: manager.functionId,
          grade: `G${gradeNum}`,
          unitId: manager.unitId,
          location,
          manager: manager.code,
          doj: randomDoj(2012, 2025),
        }),
      );
    }
  };

  // Generated L3 managers and their teams
  for (const [leaderCode, plan] of Object.entries(TEAM_PLAN)) {
    const leader = byCode.get(leaderCode)!;
    for (const [dept, n] of plan) {
      for (let i = 0; i < n; i++) {
        const p = randomPerson();
        const senior = rng() < 0.45;
        const location = leader.unitId === 'U-SLS' ? pick(rng, SALES_LOCATIONS) : leader.location;
        const mgr = make({
          code: nextCode(),
          first: p.first,
          last: p.last,
          gender: p.gender,
          designation: `${senior ? 'Senior Manager' : 'Manager'} – ${dept}`,
          department: dept,
          functionId: leader.functionId,
          grade: senior ? 'G6' : 'G5',
          unitId: leader.unitId,
          location,
          manager: leader.code,
          doj: randomDoj(2010, 2021),
        });
        employees.push(mgr);
        byCode.set(mgr.code, mgr);
        addStaff(mgr, int(rng, 4, 7));
      }
    }
    // Some senior leaders also have an individual contributor reporting directly
    if (rng() < 0.35) addStaff(leader, 1);
  }

  // Sameer Joshi (HRBP Durgapur) has a small team
  addStaff(byCode.get('E00150')!, 3);

  // A few people on leave to make listings realistic
  employees.forEach((e) => {
    if (e.level === 'staff' && rng() < 0.02) e.status = 'on_leave';
  });

  return employees;
}
