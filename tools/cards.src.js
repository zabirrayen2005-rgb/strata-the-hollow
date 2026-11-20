// Memory card sources. Edit here, then run:  node tools/build-cards.js
// Each card is signed by an issuer key. The phone only reads cards whose signature
// checks out against a key it trusts (see data/cards.js -> keys).
//   council     Resident Council: trusted from the start
//   ava         Ava's personal key: trusted contact
//   directorate Directorate key: NOT trusted, until Mara finds it leaked in the Surface Director's log
module.exports = [
  {
    id: 'clinic', title: 'Clinic records', issuer: 'L2 Clinic · Resident Council', key: 'council', color: '#ff8fb1',
    body: {
      summary: 'Patient ledger from the L2 clinic and the L6 field clinic, kept by the Resident Council.',
      facts: [
        { kw: ['clinic records', 'clinic', 'patients', 'ledger'], w: 2, a: 'Clinic records: 212 patients in the cough ward this week, 61% of them from L5 and L6. Admissions double within a day of any air-pump cut.' },
        { kw: ['cough', 'ward', 'sick', 'lung disease'], w: 1, a: 'Cough ward: 212 patients this week. Lung index in the Deep is 61 out of 100, the worst in the Hollow.' },
        { kw: ['inhaler', 'asthma'], w: 2, a: 'Clinic ledger: about 2,400 inhalers across the Hollow, but only 100 were in the Deep before triage.' },
        { kw: ['insulin', 'fridge', 'cold chain'], w: 2, a: 'The insulin fridge on L2 holds 8 hours without power. The longest outage this year was 5 h 40 min.' },
      ],
    },
  },
  {
    id: 'probe', title: 'Probe log', issuer: 'Hatch probes 01–07 · Resident Council', key: 'council', color: '#c27bff',
    body: {
      summary: 'Fourteen months of signed readings from the probes at the surface hatch.',
      facts: [
        { kw: ['probe log', 'probe', 'readings', 'history', 'trend'], w: 2, a: 'Probe log: background dose at the hatch fell 38% over 14 months. Every month since last spring sits below the Directorate’s own “lethal” line.' },
        { kw: ['eastern basin', 'basin', 'east'], w: 2, a: 'Probe log: the eastern basin has read below lethal levels for 14 months in a row.' },
        { kw: ['hotspot', 'hotspots'], w: 2, a: 'Probe log: 5 hotspots near the hatch. The strongest is 15 m west, on the old street.' },
      ],
    },
  },
  {
    id: 'ava', title: 'Ava’s messages', issuer: 'Ava · L4 Works', key: 'ava', color: '#ffcf7a',
    body: {
      summary: 'Messages from Ava, Mara’s daughter, signed with her own key.',
      facts: [
        { kw: ['ava', 'daughter', 'message', 'messages'], w: 2, a: 'Ava, 3 days ago: “Night shift on L4 again. They’re moving the farm crews to nights, so bread should be back on the list soon. Love you.”' },
        { kw: ['hatch', 'override', 'code'], w: 2, a: 'Ava, last week: “If they ever cut the network, the hatch override is in the Works ledger. I’ll send it to you, I promise.”' },
        { kw: ['l4', 'works'], w: 1, a: 'Ava works nights at L4 Works, two levels above the Deep.' },
      ],
    },
  },
  {
    id: 'archive', title: 'Directorate archive', issuer: 'Office of the Surface Director', key: 'directorate', color: '#ff5a4d',
    body: {
      summary: 'A smuggled Directorate archive card. Signed with the Directorate’s own key.',
      facts: [
        { kw: ['directorate archive', 'archive', 'directive', 'secret'], w: 3, a: 'Directive 41: “During shortages, cut lower-level power first. Do not publish the eastern basin readings.” Signed: Office of the Surface Director.' },
        { kw: ['network cut', 'order', 'rumour'], w: 2, a: 'Order 118: “Suspend the resident network during maintenance windows. Classify all surface talk as rumour control.”' },
        { kw: ['suit', 'dome', 'directorate knew', 'cover'], w: 2, a: 'Internal memo: “Sealed suits give 6+ hours outside. Domes: indefinite. Recommendation: keep the population below.”' },
      ],
    },
  },
];
