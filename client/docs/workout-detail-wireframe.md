# Treeningu detailvaate wireframe

Seotud ülesanne: [#31 – Frontend: Wireframe – stats/calendar screen](https://github.com/rakenduste-programmeerimine-2026/GymLog/issues/31).

Madala detailsusega mobiilivaade näitab [kalendrist](./workout-calendar-wireframe.md) avatud treeningu kuupäeva, harjutusi ja iga seeria raskust ning kordusi. Näide vastab kalendri 18. novembri esimesele treeningule. Andmed on kohatäited; need ei määra API vastuse vormingut ega andmebaasi skeemi.

## Mobiilivaade

```text
┌─────────────────────────────────────┐
│ [ ← Tagasi kalendrisse ]            │
│                                     │
│ Treeningu üksikasjad                │
│ 18. november 2026                   │
│ Treening 1                          │
│                                     │
│ Kükk                                │
│ ┌─────────────────────────────────┐ │
│ │ Seeria 1                        │ │
│ │ Raskus: 40 kg                   │ │
│ │ Kordused: 10                    │ │
│ ├─────────────────────────────────┤ │
│ │ Seeria 2                        │ │
│ │ Raskus: 45 kg                   │ │
│ │ Kordused: 8                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Lamades surumine                    │
│ ┌─────────────────────────────────┐ │
│ │ Seeria 1                        │ │
│ │ Raskus: 25 kg                   │ │
│ │ Kordused: 10                    │ │
│ ├─────────────────────────────────┤ │
│ │ Seeria 2                        │ │
│ │ Raskus: 27,5 kg                 │ │
│ │ Kordused: 8                     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Sisu ja navigeerimine

- Ülaosas on selge „Tagasi kalendrisse” tegevus. See viib kalendrisse tagasi ning taastab võimaluse korral kuu, valitud päeva ja kerimiskoha. Otse detailvaatesse saabudes viib sama tegevus kalendrisse treeningu kuupäeva juurde.
- Kuupäev on täielikult välja kirjutatud. „Treening 1” eristab sama päeva näidistreeninguid ega eelda salvestatud pealkirja.
- Igal harjutusel on oma pealkiri. Selle all kuvatakse nummerdatud seeriad, igal seerial raskus kilogrammides ja korduste arv. Kümnendarvudes kasutatakse eestipärast koma.
- Vaade keskendub treeningu lugemisele. Statistilised trendid, võrdlused ning muutmise ja kustutamise vood ei kuulu sellesse wireframe'i.

## Tühjad ja muud olekud

- Treening ilma harjutusteta: „Selles treeningus pole veel harjutusi.” Kuupäev ja tagasitee jäävad nähtavaks.
- Harjutus ilma seeriateta: harjutuse all „Sellel harjutusel pole seeriaid.”
- Puuduvat raskust või korduste arvu ei asendata nulliga: kuvatakse näiteks „Raskus: andmed puuduvad”.
- Tulevase laadimise ajal: „Laadin treeningut…”. Üldise vea korral: „Treeningut ei saanud laadida.” ja „Proovi uuesti”. Kui treeningut ei leitud: „Treeningut ei leitud.” Kõigis olekutes säilib nähtav tagasitee.

## Mobiil ja ligipääsetavus

- Üks veerg ja vertikaalne kerimine. Seeria väljad on üksteise all, et vältida väiksel ekraanil laia tabelit. Pikad harjutusnimed murduvad järgmisele reale.
- Tagasitegevuse puudutusala on vähemalt 44 px kõrge. Tekst on suurendatav ja ükski fikseeritud element ei kata sisu.
- Pealkirjahierarhia eristab lehe pealkirja ja harjutusi; seeriad moodustavad loogilise järjestatud loendi. Raskuse ja korduste tähendus on alati tekstina nähtav.
- Tagasitee töötab klaviatuuriga ja selle fookus on nähtav. Vaatesse saabumisel liigub fookus lehe pealkirjale; tagasi minnes taastub see võimaluse korral avatud treeningu lingil.

## Visuaalne suund

Tume taust, hele tekst, lihtsad harjutusplokid ja seeriate eraldusjooned. Neon Lime rõhutab tagasitegevust ning klaviatuuri fookust. Sisu loetavus ja ülesehitus on olulisemad kui dekoratsioon.

Tulevase Pull Requesti kirjeldus peab sisaldama eraldi rida:

Closes #31
