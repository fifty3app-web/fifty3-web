// src/api/fakeGymApi.ts

// Ρόλοι συστήματος
type Role = "TRAINER" | "CLIENT";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
}

// Fake users: 3 γυμναστές + 2 πελάτες
const users: User[] = [
  // ΓΥΜΝΑΣΤΕΣ
  {
    id: "trainer_kostas",
    fullName: "Κώστα",
    email: "kostas@fifty3.com",
    phone: "6900000001",
    role: "TRAINER",
    active: true,
  },
  {
    id: "trainer_zoe",
    fullName: "Ζωή",
    email: "zoe@fifty3.com",
    phone: "6900000002",
    role: "TRAINER",
    active: true,
  },
  {
    id: "trainer_dimitris",
    fullName: "Δημήτρη",
    email: "dimitris@fifty3.com",
    phone: "6900000003",
    role: "TRAINER",
    active: true,
  },

  // ΠΕΛΑΤΕΣ (demo)
  {
    id: "client_maria",
    fullName: "Μαρία Πελάτης",
    email: "maria@fifty3.com",
    phone: "6900000010",
    role: "CLIENT",
    active: true,
  },
  {
    id: "client_nikos",
    fullName: "Νίκος Πελάτης",
    email: "nikos@fifty3.com",
    phone: "6900000011",
    role: "CLIENT",
    active: true,
  },
];

let currentUserId: string | null = null;

// μικρή καθυστέρηση για να μοιάζει με πραγματικό API
function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// LOGIN με email (password δεν ελέγχεται – ό,τι και να βάλεις)
export async function login(
  email: string,
  password: string
): Promise<User | null> {
  await delay();

  // απλό check: όλοι έχουν κωδικό 1234
  if (password.trim() !== "1234") {
    return null;
  }

  const user = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  currentUserId = user?.id ?? null;
  return user ?? null;
}


// Τρέχων χρήστης (αν έχει γίνει login)
export function getCurrentUser(): User | null {
  if (!currentUserId) return null;
  return users.find((u) => u.id === currentUserId) ?? null;
}

// Όλοι οι πελάτες (για λίστες, αναζήτηση κτλ)
export async function getAllClients(): Promise<User[]> {
  await delay();
  return users.filter((u) => u.role === "CLIENT");
}

// Όλοι οι γυμναστές – θα μας χρειαστεί για καρτέλες ραντεβού
export async function getAllTrainers(): Promise<User[]> {
  await delay();
  return users.filter((u) => u.role === "TRAINER");
}
