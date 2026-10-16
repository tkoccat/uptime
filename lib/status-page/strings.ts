// Herkese açık durum sayfasının metinleri: sayfa sahibinin diline göre gösterilir.
// (Sayfayı ziyaret edenler sahibin müşterileridir; ana uygulama çevirilerinden bağımsızdır.)
type Strings = {
  allUp: string;
  someDown: string;
  noMonitors: string;
  uptime: string;
  days90: string;
  incidents: string;
  noIncidents: string;
  ongoing: string;
  resolved: string;
  paused: string;
  noData: string;
  poweredBy: string;
  up: string;
  down: string;
};

const STRINGS: Record<string, Strings> = {
  en: {
    allUp: "All systems operational",
    someDown: "Some systems are experiencing issues",
    noMonitors: "No monitors to show.",
    uptime: "uptime",
    days90: "Last 90 days",
    incidents: "Incident history",
    noIncidents: "No incidents in the last 90 days.",
    ongoing: "Ongoing",
    resolved: "Resolved",
    paused: "Paused",
    noData: "No data",
    poweredBy: "Powered by",
    up: "Operational",
    down: "Down",
  },
  de: {
    allUp: "Alle Systeme laufen",
    someDown: "Einige Systeme haben Probleme",
    noMonitors: "Keine Monitore vorhanden.",
    uptime: "Verfügbarkeit",
    days90: "Letzte 90 Tage",
    incidents: "Vorfallsverlauf",
    noIncidents: "Keine Vorfälle in den letzten 90 Tagen.",
    ongoing: "Andauernd",
    resolved: "Behoben",
    paused: "Pausiert",
    noData: "Keine Daten",
    poweredBy: "Betrieben von",
    up: "Funktionsfähig",
    down: "Ausgefallen",
  },
  fr: {
    allUp: "Tous les systèmes fonctionnent",
    someDown: "Certains systèmes rencontrent des problèmes",
    noMonitors: "Aucune sonde à afficher.",
    uptime: "disponibilité",
    days90: "90 derniers jours",
    incidents: "Historique des incidents",
    noIncidents: "Aucun incident ces 90 derniers jours.",
    ongoing: "En cours",
    resolved: "Résolu",
    paused: "En pause",
    noData: "Aucune donnée",
    poweredBy: "Propulsé par",
    up: "Opérationnel",
    down: "En panne",
  },
  tr: {
    allUp: "Tüm sistemler çalışıyor",
    someDown: "Bazı sistemlerde sorun var",
    noMonitors: "Gösterilecek monitör yok.",
    uptime: "uptime",
    days90: "Son 90 gün",
    incidents: "Olay geçmişi",
    noIncidents: "Son 90 günde olay yok.",
    ongoing: "Devam ediyor",
    resolved: "Çözüldü",
    paused: "Duraklatıldı",
    noData: "Veri yok",
    poweredBy: "Sağlayan",
    up: "Çalışıyor",
    down: "Çöktü",
  },
};

export function statusStrings(locale: string): Strings {
  return STRINGS[locale] ?? STRINGS.en;
}
