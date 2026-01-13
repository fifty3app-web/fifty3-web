// src/App.tsx
import React, { useState, useEffect } from "react";
import type { FormEvent } from "react";
import "./App.css";
import { getAllClients, type User } from "./api/fakeGymApi";
import logo from "./assets/fifty3-logo.png";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "./firebase";
console.log("🔥 App component started loading");

type Role = "TRAINER" | "CLIENT";

// Κάθε booking ανήκει σε ΣΥΓΚΕΚΡΙΜΕΝΟ γυμναστή
type Booking = {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  trainerId: string;
  clientIds: string[];
};
type PersistedState = {
  clients: User[];
  bookings: Booking[];
  blockedSlots: BlockedSlot[];
};

// Κλειδωμένο slot (μη διαθέσιμη ώρα για ραντεβού)
type BlockedSlot = {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  trainerId: string;
};

export default function App() {
  const [email, setEmail] = useState("kostas@fifty3.com");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- πελάτες ---
  const [clients, setClients] = useState<User[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // --- ραντεβού σε slots (για ΟΛΟΥΣ τους γυμναστές) ---
  const [bookings, setBookings] = useState<Booking[]>([]);

  // --- κλειδωμένα slots (ανά γυμναστή) ---
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);

  // φορτώνουμε αρχική λίστα πελατών
  // 🔹 Φόρτωμα από localStorage ή, αν δεν υπάρχει, από fake API
  // Φόρτωμα αρχικής κατάστασης:
  // 1) Firestore
  // 2) localStorage
  // 3) Demo από fakeGymApi
useEffect(() => {
  console.log("🔥 useEffect started");   // <-- ΒΑΛ' ΤΟ ΕΔΩ

  async function loadInitial() {
    // 1️⃣ Firestore
    try {
      const snap = await getDoc(doc(db, "state", "main"));
      if (snap.exists()) {
        const data = snap.data() as PersistedState;
        setClients(data.clients ?? []);
        setBookings(data.bookings ?? []);
        setBlockedSlots(data.blockedSlots ?? []);
          return;
        }
      } catch (err) {
        console.error("Firestore read error:", err);
      }

      // 2️⃣ localStorage (backup)
      try {
        const raw = localStorage.getItem("fifty3-state-v1");
        if (raw) {
          const data = JSON.parse(raw) as PersistedState;
          setClients(data.clients ?? []);
          setBookings(data.bookings ?? []);
          setBlockedSlots(data.blockedSlots ?? []);
          setClientsLoaded(true);
          console.log("Loaded from localStorage");
          return;
        }
      } catch (err) {
        console.error("localStorage read error:", err);
      }

      // 3️⃣ Demo – πρώτη φορά
      const list = await getAllClients();
      setClients(list);
      setClientsLoaded(true);
      console.log("Loaded demo clients from fakeGymApi");
    }

    loadInitial();
  }, []);

  // Αποθήκευση όταν αλλάζουν clients / bookings / blockedSlots
  useEffect(() => {
    if (!clientsLoaded) return; // περίμενε να φορτώσει πρώτα

    const data: PersistedState = {
      clients,
      bookings,
      blockedSlots,
    };

    // 1️⃣ localStorage (για backup)
    try {
      localStorage.setItem("fifty3-state-v1", JSON.stringify(data));
    } catch (err) {
      console.error("Αποτυχία αποθήκευσης στο localStorage:", err);
    }

    // 2️⃣ Firestore (cloud)
    setDoc(doc(db, "state", "main"), data).catch((err) => {
      console.error("Firestore write error:", err);
    });
  }, [clients, bookings, blockedSlots, clientsLoaded]);

  // ----------------- LOGIN / LOGOUT -----------------

  function getTrainerMetaFromEmail(email: string | null) {
    if (!email) return null;

    const lower = email.toLowerCase();
    if (lower === "kostas@fifty3.com") {
      return { id: "trainer-kostas", name: "Κώστας" };
    }
    if (lower === "zoe@fifty3.com") {
      return { id: "trainer-zoe", name: "Ζωή" };
    }
    if (lower === "dimitris@fifty3.com") {
      return { id: "trainer-dimitris", name: "Δημήτρης" };
    }
    return null;
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // email / password = τα state από τη φόρμα login
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const meta = getTrainerMetaFromEmail(cred.user.email);
      if (!meta) {
        setError(
          "Αυτός ο λογαριασμός δεν είναι καταχωρημένος ως γυμναστής."
        );
        setCurrentUser(null);
      } else {
        // Φτιάχνουμε έναν User ώστε να ταιριάζει με το υπόλοιπο app
        const user: User = {
          id: meta.id,
          fullName: meta.name,
          email: cred.user.email ?? "",
          role: "TRAINER",
          active: true,
        } as User;

        setCurrentUser(user);
      }
    } catch (err) {
      console.error("Firebase login error:", err);
      setError("Λάθος email ή κωδικός.");
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setEmail("kostas@fifty3.com");
    setPassword("");
  }

  // ---------- CRUD πελατών ----------
  function handleAddClient(data: { fullName: string; email: string; phone?: string }) {
    const newClient: User = {
      id: `client_${Date.now()}`,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      role: "CLIENT",
      active: true,
    } as User;

    setClients((prev) => [...prev, newClient]);
  }


  function handleUpdateClient(
    clientId: string,
    data: { fullName: string; email: string; phone?: string; active: boolean }
  ) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              fullName: data.fullName.trim(),
              email: data.email.trim(),
              phone: data.phone?.trim() || "",
              active: data.active,
            }
          : c
      )
    );
  }

  function handleDeleteClient(clientId: string) {
    // σβήνουμε τον πελάτη από τη λίστα
    setClients((prev) => prev.filter((c) => c.id !== clientId));

    // σβήνουμε τον πελάτη από όλα τα bookings
    setBookings((prev) => {
      const cleaned = prev
        .map((b) => ({
          ...b,
          clientIds: b.clientIds.filter((id) => id !== clientId),
        }))
        .filter((b) => b.clientIds.length > 0);
      return cleaned;
    });
  }

  // --------- RENDER ---------

  const trainerId =
    currentUser && currentUser.role === "TRAINER" ? currentUser.id : null;
  const trainerName =
    currentUser && currentUser.role === "TRAINER" ? currentUser.fullName : null;

  return (
    <div className="app-root">
      {/* Αριστερή στήλη: Login / πληροφορίες / πελάτες */}
      <div className="app-left">
        <div className="app-card">
          <img src={logo} alt="FIFTY3" className="app-logo" />

          {!currentUser && (
            <form onSubmit={handleLogin} className="form">
              <h2>Είσοδος</h2>

              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              {error && <p className="error">{error}</p>}

              <button type="submit" disabled={isLoading}>
                {isLoading ? "Μπαίνει..." : "Είσοδος"}
              </button>

              <p className="hint">
                Γυμναστές (web):
                <br />
                kostas@fifty3.com
                <br />
                zoe@fifty3.com
                <br />
                dimitris@fifty3.com
                <br />
                <br />
              </p>
            </form>
          )}

          {currentUser && (
            <div className="welcome">
              <div className="welcome-header">
                <div>
                  <h2>Γεια σου, {currentUser.fullName}</h2>
                  {currentUser.role === "TRAINER" ? (
                    <p>
                      Έχεις συνδεθεί ως <b>γυμναστής</b>.
                    </p>
                  ) : (
                    <p>
                      Έχεις συνδεθεί ως <b>πελάτης</b>.
                    </p>
                  )}
                </div>
                <button onClick={handleLogout}>Αποσύνδεση</button>
              </div>

              <hr className="divider" />

              {currentUser.role === "TRAINER" ? (
                <TrainerDashboard
                  trainer={currentUser}
                  clients={clients}
                  clientsLoaded={clientsLoaded}
                  onAddClient={handleAddClient}
                  onUpdateClient={handleUpdateClient}
                  onDeleteClient={handleDeleteClient}
                />
              ) : (
                <p style={{ marginTop: 8 }}>
                  Η web εφαρμογή είναι μόνο για γυμναστές.
                  <br />
                  Οι πελάτες χρησιμοποιούν την εφαρμογή Android.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Δεξιά στήλη: Ημερολόγιο με ραντεβού */}
      <div className="app-right">
        <CalendarPanel
          bookings={bookings}
          onChangeBookings={(updater) => setBookings(updater)}
          blockedSlots={blockedSlots}
          onChangeBlockedSlots={(updater) => setBlockedSlots(updater)}
          clients={clients}
          trainerId={trainerId}
          trainerName={trainerName}
        />
      </div>
    </div>
  );
}

// --------- Trainer Dashboard ---------

interface TrainerDashboardProps {
  trainer: User;
  clients: User[];
  clientsLoaded: boolean;
  onAddClient: (data: { fullName: string; email: string; phone?: string }) => void;
  onUpdateClient: (
    id: string,
    data: { fullName: string; email: string; phone?: string; active: boolean }
  ) => void;
  onDeleteClient: (id: string) => void;
}

function TrainerDashboard({
  trainer,
  clients,
  clientsLoaded,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
}: TrainerDashboardProps) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formActive, setFormActive] = useState(true);

  function startAdd() {
    setEditingId("new");
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormActive(true);
  }

  function startEdit(client: User) {
    setEditingId(client.id);
    setFormName(client.fullName);
    setFormEmail(client.email);
    setFormPhone(client.phone ?? "");
    setFormActive(client.active);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    if (editingId === "new") {
      onAddClient({ fullName: formName, email: formEmail, phone: formPhone });
    } else if (editingId && editingId !== "new") {
      onUpdateClient(editingId, {
        fullName: formName,
        email: formEmail,
        phone: formPhone,
        active: formActive,
      });
    }

    setEditingId(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormActive(true);
  }

  function handleDeleteClick(id: string) {
    if (window.confirm("Να διαγραφεί ο πελάτης;")) {
      onDeleteClient(id);
      if (editingId === id) {
        setEditingId(null);
      }
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <h3>Πελάτες του {trainer.fullName}</h3>

      {!clientsLoaded && <p>Φόρτωση πελατών...</p>}

      {clientsLoaded && clients.length === 0 && (
        <p>Δεν υπάρχουν πελάτες. Πρόσθεσε τον πρώτο!</p>
      )}

      {clientsLoaded && clients.length > 0 && (
        <ul className="client-list">
          {clients.map((c) => (
            <li
              key={c.id}
              className={`client-item ${
                editingId === c.id ? "client-item-selected" : ""
              }`}
            >
              <div className="client-name">{c.fullName}</div>
              <div className="client-email">{c.email}</div>

              <div className="client-bottom-row">
                {c.phone && (
                  <span className="client-phone">Τηλ: {c.phone}</span>
                )}

                <div className="client-actions">
                  <button type="button" onClick={() => startEdit(c)}>
                    Επεξεργασία
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(c.id)}
                    className="client-delete-button"
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={startAdd}
        style={{ marginTop: 8, width: "100%" }}
      >
        + Νέος πελάτης
      </button>

      {editingId && (
        <form onSubmit={handleSubmit} className="client-form">
          <h4>
            {editingId === "new" ? "Νέος πελάτης" : "Επεξεργασία πελάτη"}
          </h4>

          <label className="field">
            <span>Ονοματεπώνυμο</span>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Κινητό τηλέφωνο</span>
            <input
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="69..."
            />
          </label>

          {editingId !== "new" && (
            <label
              className="field"
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
              />
              <span>Ενεργός πελάτης</span>
            </label>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="submit">Αποθήκευση</button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              style={{ background: "#444", color: "#fff" }}
            >
              Ακύρωση
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// --------- Ημερολόγιο με popup, αναζήτηση & ΚΛΕΙΔΩΜΑ ΏΡΑΣ ---------

interface CalendarPanelProps {
  bookings: Booking[];
  onChangeBookings: (updater: (prev: Booking[]) => Booking[]) => void;
  blockedSlots: BlockedSlot[];
  onChangeBlockedSlots: (updater: (prev: BlockedSlot[]) => BlockedSlot[]) => void;
  clients: User[];
  trainerId: string | null;
  trainerName: string | null;
}

function CalendarPanel({
  bookings,
  onChangeBookings,
  blockedSlots,
  onChangeBlockedSlots,
  clients,
  trainerId,
  trainerName,
}: CalendarPanelProps) {
  const [monthOffset, setMonthOffset] = useState(0);

  // slot που είναι ανοιχτό + θέση popup
  const [selectedSlot, setSelectedSlot] = useState<{
    day: number;
    hour: number;
    x: number;
    y: number;
  } | null>(null);

  // πρόχειρη (draft) λίστα clientIds για το ανοιχτό slot
  const [draftClientIds, setDraftClientIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");

  const MAX_PER_SLOT = 3;

  const today = new Date();
  const baseDate = new Date(
    today.getFullYear(),
    today.getMonth() + monthOffset,
    1
  );

  const year = baseDate.getFullYear();
  const monthIndex = baseDate.getMonth(); // 0–11
  const monthName = baseDate.toLocaleString("el-GR", { month: "long" });

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNumber = i + 1;
    const d = new Date(year, monthIndex, dayNumber);
    const weekday = d.toLocaleDateString("el-GR", { weekday: "long" });
    return { day: dayNumber, weekday };
  });

  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

  // όταν αλλάζεις μήνα ή trainer, κλείνει popup
  useEffect(() => {
    setSelectedSlot(null);
    setDraftClientIds([]);
    setSearchText("");
  }, [monthOffset, trainerId]);

  // αν δεν έχει συνδεθεί γυμναστής, απλά μήνυμα
  if (!trainerId) {
    return (
      <div className="calendar">
        <h2>Ημερολόγιο</h2>
        <p>Συνδέσου ως γυμναστής για να δεις και να ορίσεις ραντεβού.</p>
      </div>
    );
  }

  function getBooking(day: number, hour: number): Booking | undefined {
    return bookings.find(
      (b) =>
        b.year === year &&
        b.month === monthIndex &&
        b.day === day &&
        b.hour === hour &&
        b.trainerId === trainerId
    );
  }

  function getSlotClientIds(day: number, hour: number): string[] {
    const booking = getBooking(day, hour);
    return booking?.clientIds ?? [];
  }

  function getSlotOccupancy(day: number, hour: number): number {
    return getSlotClientIds(day, hour).length;
  }

  function getSlotClients(day: number, hour: number): User[] {
    const ids = getSlotClientIds(day, hour);
    return ids
      .map((id) => clients.find((c) => c.id === id))
      .filter((c): c is User => Boolean(c));
  }

  // έλεγχος αν slot είναι κλειδωμένο για τον τρέχοντα trainer
  function isBlocked(day: number, hour: number): boolean {
    return blockedSlots.some(
      (s) =>
        s.year === year &&
        s.month === monthIndex &&
        s.day === day &&
        s.hour === hour &&
        s.trainerId === trainerId
    );
  }

function lockSlot(day: number, hour: number) {
  // αν είναι ήδη κλειδωμένο, δεν κάνουμε τίποτα
  if (isBlocked(day, hour)) return;

  // απλά προσθέτουμε το slot στη λίστα κλειδωμένων
  onChangeBlockedSlots((prev) => [
    ...prev,
    { year, month: monthIndex, day, hour, trainerId },
  ]);

  // ΔΕΝ πειράζουμε bookings
  // ΔΕΝ καθαρίζουμε draft – μένουν όπως είναι
}

  function unlockSlot(day: number, hour: number) {
    onChangeBlockedSlots((prev) =>
      prev.filter(
        (s) =>
          !(
            s.year === year &&
            s.month === monthIndex &&
            s.day === day &&
            s.hour === hour &&
            s.trainerId === trainerId
          )
      )
    );
  }

  // κλικ στο κελί → ανοίγει popup + αντιγράφουμε τα τωρινά clientIds στο draft
  function handleCellClick(day: number, hour: number, e: any) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.right + 8;
    const y = rect.top; // viewport coords (position: fixed)

    setSelectedSlot({ day, hour, x, y });
    setDraftClientIds(getSlotClientIds(day, hour));
    setSearchText("");
  }

  // toggle σε draft (όχι αμέσως στο booking)
  function toggleClientInDraft(clientId: string) {
    setDraftClientIds((prev) => {
      const already = prev.includes(clientId);
      if (already) {
        return prev.filter((id) => id !== clientId);
      } else {
        if (prev.length >= MAX_PER_SLOT) {
          alert("Το συγκεκριμένο slot έχει ήδη 3 άτομα (draft).");
          return prev;
        }
        return [...prev, clientId];
      }
    });
  }

  // Save → γράφουμε το draft στο bookings για ΣΥΓΚΕΚΡΙΜΕΝΟ trainer
  function handleSaveSlot() {
    if (!selectedSlot) return;

    // αν είναι κλειδωμένο, δεν αποθηκεύουμε ραντεβού
    if (isBlocked(selectedSlot.day, selectedSlot.hour)) {
      alert("Η ώρα είναι κλειδωμένη. Ξεκλείδωσέ την πρώτα για να βάλεις ραντεβού.");
      return;
    }

    const { day, hour } = selectedSlot;

    onChangeBookings((prev) => {
      const idx = prev.findIndex(
        (b) =>
          b.year === year &&
          b.month === monthIndex &&
          b.day === day &&
          b.hour === hour &&
          b.trainerId === trainerId
      );

      // αν δεν έχει μείνει κανένας -> σβήνουμε τελείως το booking
      if (draftClientIds.length === 0) {
        if (idx === -1) return prev;
        const clone = [...prev];
        clone.splice(idx, 1);
        return clone;
      }

      if (idx === -1) {
        // καινούριο booking για αυτόν τον trainer
        return [
          ...prev,
          {
            year,
            month: monthIndex,
            day,
            hour,
            trainerId,
            clientIds: draftClientIds,
          },
        ];
      } else {
        const clone = [...prev];
        clone[idx] = {
          ...prev[idx],
          clientIds: draftClientIds,
        };
        return clone;
      }
    });
  }

  // Edit = revert draft στα αποθηκευμένα δεδομένα
  function handleResetSlot() {
    if (!selectedSlot) return;
    const { day, hour } = selectedSlot;
    setDraftClientIds(getSlotClientIds(day, hour));
    setSearchText("");
  }

  function formatSelectedSlotTitle(slot: { day: number; hour: number }) {
    const d = new Date(year, monthIndex, slot.day);
    const weekdayFull = d.toLocaleDateString("el-GR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const hh = slot.hour.toString().padStart(2, "0");
    return `${weekdayFull}, ${hh}:00`;
  }

  const activeClients = clients.filter((c) => c.role === "CLIENT" && c.active);

  const filteredClients = activeClients.filter((c) => {
    if (!searchText.trim()) return true;
    const s = searchText.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      (c.phone ?? "").toLowerCase().includes(s)
    );
  });

  const selectedClientNamesLine =
    draftClientIds
      .map((id) => activeClients.find((c) => c.id === id)?.fullName)
      .filter(Boolean)
      .join(", ") || "—";

  const isCurrentSlotBlocked =
    selectedSlot && isBlocked(selectedSlot.day, selectedSlot.hour);

  return (
    <div className="calendar">
      <div className="calendar-header-row">
        <button
          className="calendar-nav-button"
          onClick={() => setMonthOffset((m) => m - 1)}
        >
          ◀ Προηγούμενος
        </button>

        <h2>
          Ημερολόγιο – {monthName} {year}
          {trainerName ? ` – ${trainerName}` : ""}
        </h2>

        <button
          className="calendar-nav-button"
          onClick={() => setMonthOffset((m) => m + 1)}
        >
          Επόμενος ▶
        </button>
      </div>

      <div className="calendar-scroll">
        <div
          className="calendar-grid"
          style={{
            gridTemplateColumns: `120px repeat(${hours.length}, 1fr)`,
          }}
        >
          {/* Πάνω γραμμή: "Ημέρα" + ώρες */}
          <div className="calendar-top-left-cell">Ημέρα</div>
          {hours.map((h) => (
            <div key={`h-${h}`} className="calendar-header-cell">
              {h.toString().padStart(2, "0")}:00
            </div>
          ))}

          {/* Γραμμές μέρες μήνα */}
          {days.flatMap(({ day, weekday }) => {
            const row: JSX.Element[] = [];

            row.push(
              <div key={`label-${day}`} className="calendar-day-label">
                <span className="calendar-day-number">{day}</span>
                <span className="calendar-day-weekday">{weekday}</span>
              </div>
            );

            for (const h of hours) {
              const occ = getSlotOccupancy(day, h);
              const blocked = isBlocked(day, h);

              let occupancyClass = "slot-empty";
              if (occ === 1) occupancyClass = "slot-low";
              else if (occ === 2) occupancyClass = "slot-medium";
              else if (occ >= 3) occupancyClass = "slot-full";

              let cellClass = occupancyClass;
              let tooltip: string;

              if (blocked) {
                cellClass = "slot-blocked";
                tooltip = "Κλειδωμένο – δεν δέχεται ραντεβού";
              } else {
                const slotClients = getSlotClients(day, h);
                tooltip =
                  occ === 0
                    ? "Κανένα ραντεβού"
                    : slotClients.map((c) => c.fullName).join(", ");
              }

              const isSelected =
                selectedSlot?.day === day && selectedSlot.hour === h;

              row.push(
                <div
                  key={`cell-${day}-${h}`}
                  className={`calendar-cell ${cellClass} ${
                    isSelected ? "slot-selected" : ""
                  }`}
                  onClick={(e) => handleCellClick(day, h, e)}
                  title={tooltip}
                >
                  {blocked ? "✕" : occ > 0 ? occ : ""}
                </div>
              );
            }

            return row;
          })}
        </div>
      </div>

      <p className="calendar-hint">
        Κλικ σε κελί → άνοιγμα popup και επιλογή πελατών ή κλείδωμα ώρας.
        <br />
        Χρώμα: μαύρο=0, κίτρινο=1, πορτοκαλί=2, κόκκινο=3 άτομα, ραβδωτό=κλειδωμένο.
        <br />
        Πέρασμα κέρσορα πάνω από κελί → εμφανίζει τα ραντεβού (tooltip).
      </p>

      {selectedSlot && (
        <div
          className="slot-editor-popup"
          style={{ top: selectedSlot.y, left: selectedSlot.x }}
        >
          <div className="slot-editor">
            <div className="slot-editor-header">
              <h3>Ραντεβού για {formatSelectedSlotTitle(selectedSlot)}</h3>
              <button
                className="slot-editor-close"
                type="button"
                onClick={() => setSelectedSlot(null)}
              >
                ✕
              </button>
            </div>

            <div className="slot-editor-actions-row">
              <button
                type="button"
                className="slot-editor-edit-button"
                onClick={handleResetSlot}
              >
                Edit
              </button>
              <button
                type="button"
                className="slot-editor-save-button"
                onClick={handleSaveSlot}
              >
                Save
              </button>
              <button
                type="button"
                className={
                  isCurrentSlotBlocked
                    ? "slot-editor-unlock-button"
                    : "slot-editor-lock-button"
                }
                onClick={() => {
                  if (!selectedSlot) return;
                  if (isCurrentSlotBlocked) {
                    unlockSlot(selectedSlot.day, selectedSlot.hour);
                  } else {
                    lockSlot(selectedSlot.day, selectedSlot.hour);
                  }
                }}
              >
                {isCurrentSlotBlocked ? "Ξεκλείδωμα" : "Κλείδωμα"}
              </button>
            </div>

            <div className="slot-editor-selected-line">
              <span className="slot-editor-selected-label">Επιλεγμένοι:</span>{" "}
              <span className="slot-editor-selected-names">
                {selectedClientNamesLine}
              </span>
            </div>

            {isCurrentSlotBlocked ? (
              <p className="slot-editor-blocked-msg">
                Αυτή η ώρα είναι <b>κλειδωμένη</b> και δεν δέχεται ραντεβού.
                Μπορείς να την ξεκλειδώσεις από το κουμπί{" "}
                <b>Ξεκλείδωμα</b>.
              </p>
            ) : (
              <>
                <div className="slot-editor-search">
                  <input
                    placeholder="Αναζήτηση πελάτη (όνομα, email, τηλ)"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>

                {activeClients.length === 0 && (
                  <p style={{ marginTop: 8 }}>
                    Δεν υπάρχουν ενεργοί πελάτες.
                  </p>
                )}

                {activeClients.length > 0 && (
                  <div className="slot-editor-list">
                    {filteredClients.map((c) => {
                      const isSelected = draftClientIds.includes(c.id);

                      return (
                        <div
                          key={c.id}
                          className={`slot-editor-item ${
                            isSelected ? "slot-editor-item-selected" : ""
                          }`}
                          onClick={() => toggleClientInDraft(c.id)}
                        >
                          <span className="slot-editor-indicator">
                            {isSelected ? "●" : "○"}
                          </span>
                          <span className="slot-editor-name">
                            {c.fullName}
                          </span>
                          <span className="slot-editor-email">{c.email}</span>
                          {c.phone && (
                            <span className="slot-editor-phone">
                              {c.phone}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
