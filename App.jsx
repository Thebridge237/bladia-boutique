import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  Gem, Package, TrendingUp, Copy, Check, LogOut, ArrowRight, X,
  Truck, CircleCheck, Clock, Smartphone, Mail, CreditCard,
} from "lucide-react";

const RATE_COMMISSION = 0.12;

const PRODUITS = [
  { id: "p1", nom: "Écouteurs Pulse X", cat: "Audio", prix: 25000, desc: "Réduction de bruit active, 30h d'autonomie.", emoji: "🎧" },
  { id: "p2", nom: "Montre Fit S3", cat: "Wearable", prix: 35000, desc: "Suivi santé, GPS, étanche 50m.", emoji: "⌚" },
  { id: "p3", nom: "Powerbank Solaire 20K", cat: "Énergie", prix: 18000, desc: "20000mAh, charge solaire d'appoint.", emoji: "🔋" },
  { id: "p4", nom: "Enceinte Wave", cat: "Audio", prix: 22000, desc: "Son 360°, résistante à l'eau IPX6.", emoji: "🔊" },
  { id: "p5", nom: "Chargeur Rapide Air", cat: "Énergie", prix: 12000, desc: "Charge sans fil 15W, design compact.", emoji: "🔌" },
  { id: "p6", nom: "Bracelet Connecté Mini", cat: "Wearable", prix: 15000, desc: "Notifications, rythme cardiaque, léger.", emoji: "📿" },
];

const STATUTS = [
  { id: "recu", label: "Reçu", color: "#FBBF24", icon: Clock },
  { id: "valide", label: "Validé", color: "#60A5FA", icon: CircleCheck },
  { id: "livre", label: "Livré", color: "#34D399", icon: Truck },
];

const MOYENS = [
  { id: "mtn", label: "MTN Money", champ: "téléphone", icon: Smartphone },
  { id: "orange", label: "Orange Money", champ: "téléphone", icon: Smartphone },
  { id: "paypal", label: "PayPal", champ: "email", icon: Mail },
];

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function genCode(nom) {
  const base = nom.trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "AFF";
  return base + Math.floor(100 + Math.random() * 900);
}

function semaineDe(dateStr) {
  const d = new Date(dateStr);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  const semaine = 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
  return `${d.getFullYear()}-S${String(semaine).padStart(2, "0")}`;
}

function statutInfo(id) {
  return STATUTS.find((s) => s.id === id) || STATUTS[0];
}

export default function App() {
  const [view, setView] = useState("boutique");
  const [session, setSession] = useState(null);
  const [affiliate, setAffiliate] = useState(null);
  const [orders, setOrders] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [buyModal, setBuyModal] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setAffiliate(null); setOrders([]); setPaiements([]); return; }
    (async () => {
      const { data: aff } = await supabase.from("affiliates").select("*").eq("id", session.user.id).single();
      setAffiliate(aff);
      if (aff) {
        const { data: ords } = await supabase.from("orders").select("*").eq("code_affilie", aff.code).order("created_at", { ascending: false });
        setOrders(ords || []);
        const { data: pay } = await supabase.from("paiements_commission").select("*").eq("code_affilie", aff.code);
        setPaiements(pay || []);
        setView("dashboard");
      }
    })();
  }, [session]);

  async function handleSignup(nom, email, motdepasse) {
    if (!nom || !email || !motdepasse) return showToast("Remplis tous les champs.");
    const { data, error } = await supabase.auth.signUp({ email, password: motdepasse });
    if (error) return showToast(error.message);
    let code = genCode(nom);
    const { error: err2 } = await supabase.from("affiliates").insert({ id: data.user.id, code, nom, email, moyens_paiement: [] });
    if (err2) return showToast("Compte créé, mais erreur profil : " + err2.message);
    showToast(`Compte créé — ton code est ${code}. Vérifie tes emails si une confirmation est requise.`);
  }

  async function handleLogin(email, motdepasse) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: motdepasse });
    if (error) return showToast(error.message);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setView("boutique");
  }

  async function handleAchat(produit, code, nom, prenom, telephone, lieu) {
    const { error } = await supabase.from("orders").insert({
      produit_id: produit.id,
      produit_nom: produit.nom,
      prix: produit.prix,
      client_nom: nom,
      client_prenom: prenom,
      client_telephone: telephone,
      client_lieu_livraison: lieu,
      code_affilie: code || null,
      statut: "recu",
    });
    if (error) return showToast("Erreur : " + error.message);
    setBuyModal(null);
    showToast(code ? `Commande enregistrée via le code ${code} ✔` : "Commande enregistrée ✔");
  }

  async function handleUpdateMoyens(moyens) {
    const { error } = await supabase.from("affiliates").update({ moyens_paiement: moyens }).eq("id", session.user.id);
    if (error) return showToast("Erreur : " + error.message);
    setAffiliate({ ...affiliate, moyens_paiement: moyens });
    showToast("Moyens de paiement mis à jour");
  }

  if (loading) {
    return <div style={{ background: "#050505", minHeight: "100vh" }} className="flex items-center justify-center">
      <div style={{ color: "#C9CDD3", fontFamily: "monospace" }}>chargement…</div>
    </div>;
  }

  return (
    <div style={{ background: "#050505", minHeight: "100vh" }} className="text-stone-100">
      <Nav view={view} setView={setView} session={session} />

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg text-sm mono" style={{ background: "#E8EAEE", color: "#050505" }}>
          {toast}
        </div>
      )}

      {view === "boutique" && <Boutique onBuy={(p) => setBuyModal(p)} />}
      {view === "connexion" && !session && <Connexion onLogin={handleLogin} goSignup={() => setView("inscription")} />}
      {view === "inscription" && !session && <Inscription onSignup={handleSignup} goLogin={() => setView("connexion")} />}
      {view === "dashboard" && affiliate && (
        <Dashboard affiliate={affiliate} orders={orders} paiements={paiements} onLogout={handleLogout} onUpdateMoyens={handleUpdateMoyens} />
      )}

      {buyModal && <BuyModal produit={buyModal} onClose={() => setBuyModal(null)} onConfirm={handleAchat} />}

      <footer className="text-center py-8 text-xs mono" style={{ color: "#4A4C50" }}>
        Black Diamond Electronics — BLADIA
      </footer>
    </div>
  );
}

function Nav({ view, setView, session }) {
  const item = (id, label) => (
    <button onClick={() => setView(id)} className="mono text-xs uppercase tracking-wider px-3 py-2 rounded transition-colors"
      style={{ color: view === id ? "#050505" : "#D8DADD", background: view === id ? "#E8EAEE" : "transparent" }}>
      {label}
    </button>
  );
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#1C1D20" }}>
      <div className="flex items-center gap-2 disp text-base font-bold tracking-wide" style={{ color: "#E8EAEE" }}>
        <Gem size={20} style={{ color: "#C9CDD3" }} /> BLACK DIAMOND <span className="mono text-xs font-normal" style={{ color: "#6A6D72" }}>· BLADIA</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {item("boutique", "Boutique")}
        {session ? item("dashboard", "Mon espace") : item("connexion", "Espace affilié")}
      </div>
    </nav>
  );
}

function Boutique({ onBuy }) {
  return (
    <div className="px-6 py-10 max-w-6xl mx-auto">
      <div className="mb-10">
        <div className="mono text-xs uppercase tracking-widest mb-2" style={{ color: "#9BA0A6" }}>Accessoires connectés</div>
        <h1 className="disp text-4xl md:text-5xl font-bold leading-tight" style={{ color: "#F5F5F7" }}>
          L'éclat de la <span className="chrome" style={{ WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>technologie</span>.
        </h1>
        <p className="mt-3 text-stone-400 max-w-xl">Écouteurs, montres, énergie mobile — sélectionnés pour durer.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PRODUITS.map((p) => (
          <div key={p.id} className="rounded-xl p-5 flex flex-col justify-between" style={{ background: "#0D0E10", border: "1px solid #1C1D20" }}>
            <div>
              <div className="text-4xl mb-3">{p.emoji}</div>
              <div className="mono text-xs uppercase tracking-wider mb-1" style={{ color: "#7C8288" }}>{p.cat}</div>
              <h3 className="disp text-lg font-bold" style={{ color: "#F5F5F7" }}>{p.nom}</h3>
              <p className="text-sm text-stone-400 mt-1">{p.desc}</p>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="mono font-semibold" style={{ color: "#D8DADD" }}>{fmt(p.prix)}</span>
              <button onClick={() => onBuy(p)} className="chrome flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-transform hover:scale-105" style={{ color: "#050505" }}>
                Acheter <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuyModal({ produit, onClose, onConfirm }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [lieu, setLieu] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");

  function confirmer() {
    if (!nom || !prenom || !telephone || !lieu) { setErreur("Merci de remplir nom, prénom, téléphone et lieu de livraison."); return; }
    onConfirm(produit, code ? code.toUpperCase() : null, nom, prenom, telephone, lieu);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 overflow-y-auto py-8" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-sm rounded-xl p-6 relative" style={{ background: "#0D0E10", border: "1px solid #1C1D20" }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-200"><X size={18} /></button>
        <div className="text-3xl mb-2">{produit.emoji}</div>
        <h3 className="disp text-lg font-bold" style={{ color: "#F5F5F7" }}>{produit.nom}</h3>
        <div className="mono mb-4" style={{ color: "#D8DADD" }}>{fmt(produit.prix)}</div>

        <Champ label="Nom" value={nom} setValue={setNom} />
        <Champ label="Prénom" value={prenom} setValue={setPrenom} />
        <Champ label="Numéro de téléphone" value={telephone} setValue={setTelephone} />
        <Champ label="Lieu de livraison" value={lieu} setValue={setLieu} />
        <Champ label="Code affilié (optionnel)" value={code} setValue={setCode} />
        {erreur && <div className="text-xs mt-1" style={{ color: "#F87171" }}>{erreur}</div>}

        <button onClick={confirmer} className="chrome w-full mt-4 py-2.5 rounded-lg font-medium" style={{ color: "#050505" }}>
          Valider la commande
        </button>
      </div>
    </div>
  );
}

function Connexion({ onLogin, goSignup }) {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  return (
    <div className="px-6 py-16 max-w-sm mx-auto">
      <h2 className="disp text-2xl font-bold mb-1" style={{ color: "#F5F5F7" }}>Espace affilié</h2>
      <p className="text-sm text-stone-400 mb-6">Connecte-toi pour suivre tes ventes.</p>
      <Champ label="Email" value={email} setValue={setEmail} type="email" />
      <Champ label="Mot de passe" value={mdp} setValue={setMdp} type="password" />
      <button onClick={() => onLogin(email, mdp)} className="chrome w-full mt-3 py-2.5 rounded-lg font-medium" style={{ color: "#050505" }}>
        Se connecter
      </button>
      <p className="text-sm text-stone-400 mt-4">
        Pas encore de compte ? <button onClick={goSignup} className="underline" style={{ color: "#B8BEC6" }}>Devenir affilié</button>
      </p>
    </div>
  );
}

function Inscription({ onSignup, goLogin }) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  return (
    <div className="px-6 py-16 max-w-sm mx-auto">
      <h2 className="disp text-2xl font-bold mb-1" style={{ color: "#F5F5F7" }}>Devenir affilié</h2>
      <p className="text-sm text-stone-400 mb-6">Reçois un code unique et {Math.round(RATE_COMMISSION * 100)}% de commission sur chaque vente <b>livrée</b>.</p>
      <Champ label="Nom" value={nom} setValue={setNom} />
      <Champ label="Email" value={email} setValue={setEmail} type="email" />
      <Champ label="Mot de passe (min. 6 caractères)" value={mdp} setValue={setMdp} type="password" />
      <button onClick={() => onSignup(nom, email, mdp)} className="chrome w-full mt-3 py-2.5 rounded-lg font-medium" style={{ color: "#050505" }}>
        Créer mon compte
      </button>
      <p className="text-sm text-stone-400 mt-4">
        Déjà affilié ? <button onClick={goLogin} className="underline" style={{ color: "#B8BEC6" }}>Se connecter</button>
      </p>
    </div>
  );
}

function Champ({ label, value, setValue, type = "text" }) {
  return (
    <div className="mb-3">
      <label className="text-xs mono uppercase tracking-wider text-stone-400">{label}</label>
      <input type={type} value={value} onChange={(e) => setValue(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "#050505", border: "1px solid #1C1D20", color: "#F5F5F7" }} />
    </div>
  );
}

function Badge({ statut }) {
  const s = statutInfo(statut);
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mono" style={{ background: `${s.color}1A`, color: s.color, border: `1px solid ${s.color}44` }}>
      <Icon size={12} /> {s.label}
    </span>
  );
}

function MoyensPaiement({ affiliate, onSave }) {
  const initial = {};
  MOYENS.forEach((m) => { initial[m.id] = { actif: false, valeur: "" }; });
  (affiliate.moyens_paiement || []).forEach((mp) => { initial[mp.type] = { actif: true, valeur: mp.valeur }; });
  const [etat, setEtat] = useState(initial);
  const [saved, setSaved] = useState(false);

  function toggle(id) {
    setEtat({ ...etat, [id]: { ...etat[id], actif: !etat[id].actif } });
  }
  function setValeur(id, v) {
    setEtat({ ...etat, [id]: { ...etat[id], valeur: v } });
  }
  function enregistrer() {
    const moyens = MOYENS.filter((m) => etat[m.id].actif && etat[m.id].valeur.trim())
      .map((m) => ({ type: m.id, valeur: etat[m.id].valeur.trim() }));
    onSave(moyens);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-xl p-4 mb-8" style={{ background: "#0D0E10", border: "1px solid #1C1D20" }}>
      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={16} style={{ color: "#D8DADD" }} />
        <h3 className="disp font-bold text-sm" style={{ color: "#F5F5F7" }}>Moyens de paiement</h3>
      </div>
      <p className="text-xs text-stone-500 mb-4">Sélectionne un ou plusieurs moyens pour recevoir tes commissions.</p>
      <div className="space-y-3">
        {MOYENS.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.id}>
              <label className="flex items-center gap-2 text-sm mb-1 cursor-pointer" style={{ color: "#D8DADD" }}>
                <input type="checkbox" checked={etat[m.id].actif} onChange={() => toggle(m.id)} />
                <Icon size={14} /> {m.label}
              </label>
              {etat[m.id].actif && (
                <input
                  value={etat[m.id].valeur}
                  onChange={(e) => setValeur(m.id, e.target.value)}
                  placeholder={m.champ === "téléphone" ? "Ex: +237 6XX XXX XXX" : "Ex: toi@email.com"}
                  type={m.champ === "email" ? "email" : "tel"}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "#050505", border: "1px solid #1C1D20", color: "#F5F5F7" }}
                />
              )}
            </div>
          );
        })}
      </div>
      <button onClick={enregistrer} className="chrome mt-4 px-4 py-2 rounded-lg text-sm font-medium" style={{ color: "#050505" }}>
        {saved ? "Enregistré ✔" : "Enregistrer"}
      </button>
    </div>
  );
}

function Dashboard({ affiliate, orders, paiements, onLogout, onUpdateMoyens }) {
  const [copied, setCopied] = useState(false);
  const livres = orders.filter((o) => o.statut === "livre");
  const enCours = orders.filter((o) => o.statut !== "livre");
  const totalLivre = livres.reduce((s, o) => s + Number(o.prix), 0);
  const totalEnCours = enCours.reduce((s, o) => s + Number(o.prix), 0);
  const commissionConfirmee = Math.round(totalLivre * RATE_COMMISSION);
  const commissionPotentielle = Math.round(totalEnCours * RATE_COMMISSION);
  const lien = `boutique-bladia.com/?code=${affiliate.code}`;

  const semaines = {};
  livres.forEach((o) => {
    const sem = semaineDe(o.created_at);
    semaines[sem] = (semaines[sem] || 0) + Number(o.prix);
  });
  const rapport = Object.entries(semaines).map(([sem, total]) => ({
    semaine: sem, total, commission: Math.round(total * RATE_COMMISSION),
    paye: !!paiements.find((p) => p.semaine === sem)?.paye,
  })).sort((a, b) => b.semaine.localeCompare(a.semaine));

  function copier() {
    navigator.clipboard?.writeText(lien);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="mono text-xs uppercase tracking-widest" style={{ color: "#9BA0A6" }}>Bienvenue</div>
          <h2 className="disp text-3xl font-bold" style={{ color: "#F5F5F7" }}>{affiliate.nom}</h2>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200">
          <LogOut size={15} /> Déconnexion
        </button>
      </div>

      <div className="rounded-xl p-4 mb-8 flex items-center justify-between flex-wrap gap-3" style={{ background: "#0D0E10", border: "1px solid #1C1D20" }}>
        <div>
          <div className="text-xs text-stone-400 mb-1">Ton lien / code affilié</div>
          <div className="mono" style={{ color: "#D8DADD" }}>{lien}</div>
        </div>
        <button onClick={copier} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm" style={{ background: copied ? "#1E3B2E" : "#17181B", color: "#F5F5F7" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copié" : "Copier"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Stat icon={<Package size={16} />} label="Ventes suivies" value={orders.length} />
        <Stat icon={<Clock size={16} />} label="Commission potentielle" value={fmt(commissionPotentielle)} note="livraison en cours" />
        <Stat icon={<TrendingUp size={16} />} label="Commission confirmée" value={fmt(commissionConfirmee)} accent />
      </div>

      <MoyensPaiement affiliate={affiliate} onSave={onUpdateMoyens} />

      <h3 className="disp font-bold mb-3" style={{ color: "#F5F5F7" }}>Reporting hebdomadaire (paiement)</h3>
      {rapport.length === 0 ? (
        <p className="text-sm text-stone-500 mb-8">Aucune commission confirmée pour le moment.</p>
      ) : (
        <div className="space-y-2 mb-8">
          {rapport.map((r) => (
            <div key={r.semaine} className="flex items-center justify-between rounded-lg px-4 py-3 text-sm flex-wrap gap-2" style={{ background: "#0D0E10", border: "1px solid #1C1D20" }}>
              <div className="mono text-stone-300">{r.semaine}</div>
              <div className="mono text-stone-400">{fmt(r.total)} livrés</div>
              <div className="mono font-semibold" style={{ color: "#D8DADD" }}>{fmt(r.commission)}</div>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mono"
                style={{ background: r.paye ? "#1E3B2E" : "#3B2E1A", color: r.paye ? "#34D399" : "#FBBF24" }}>
                {r.paye ? <Check size={12} /> : <Clock size={12} />} {r.paye ? "Payé" : "En attente"}
              </span>
            </div>
          ))}
        </div>
      )}

      <h3 className="disp font-bold mb-3" style={{ color: "#F5F5F7" }}>Historique des ventes</h3>
      {orders.length === 0 ? (
        <p className="text-sm text-stone-500">Aucune vente enregistrée pour le moment. Partage ton lien pour commencer à générer des ventes.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg px-4 py-3 text-sm flex-wrap gap-2" style={{ background: "#0D0E10", border: "1px solid #1C1D20" }}>
              <div>
                <div style={{ color: "#F5F5F7" }}>{o.produit_nom}</div>
                <div className="text-xs text-stone-500">{o.client_prenom} {o.client_nom} · {new Date(o.created_at).toLocaleDateString("fr-FR")}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge statut={o.statut} />
                <div className="mono" style={{ color: "#D8DADD" }}>{fmt(o.prix)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent, note }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "#0D0E10", border: `1px solid ${accent ? "#3A3D42" : "#1C1D20"}` }}>
      <div className="flex items-center gap-1 text-xs text-stone-400 mb-1">{icon} {label}</div>
      <div className="mono text-xl font-semibold" style={{ color: accent ? "#34D399" : "#F5F5F7" }}>{value}</div>
      {note && <div className="text-xs text-stone-500 mt-0.5">{note}</div>}
    </div>
  );
}
