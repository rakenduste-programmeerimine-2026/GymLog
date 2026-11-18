# Uue treeningu lisamise wireframe

Seotud ülesanne: [#30 – Frontend: Wireframe – workout logging screen](https://github.com/rakenduste-programmeerimine-2026/GymLog/issues/30).

## Eesmärk

Lihtne mobiilivaade, kus kasutaja valib harjutuse ning sisestab iga seeria raskuse ja korduste arvu. See dokument kirjeldab ekraani ülesehitust; töötav vorm ja andmete salvestamine kuuluvad hilisemasse teostusse.

## Mobiilivaade

Üks veerg, mis mahub väikesele ekraanile ilma horisontaalse kerimiseta. Allolevad väärtused on näidisandmed, mitte eeltäidetud vaikeväärtused.

```text
┌──────────────────────────────────┐
│ GymLog                           │
│                                  │
│ Uus treening                     │
│ Lisa harjutus ja selle seeriad.   │
│                                  │
│ Harjutus                         │
│ [ Vali harjutus               ▾ ]│
│                                  │
│ Seeria 1                         │
│ Raskus (kg)                      │
│ [ 20                           ] │
│ Kordused                         │
│ [ 10                           ] │
│                                  │
│ Seeria 2                         │
│ Raskus (kg)                      │
│ [ 20                           ] │
│ Kordused                         │
│ [ 8                            ] │
│                                  │
│ [ + Lisa seeria                ] │
│                                  │
│ [ Salvesta treening            ] │
└──────────────────────────────────┘
```

## Väljad ja tegevused

| Element | Kavandatud käitumine |
| --- | --- |
| **Harjutus** | Rippmenüü nähtava sildiga. Alguses „Vali harjutus”; näidisvalikud on „Kükk”, „Lamades surumine” ja „Jõutõmme”. Valik kehtib allolevatele seeriatele. |
| **Seeria 1, Seeria 2, …** | Nummerdatud plokid, igaühes oma raskuse ja korduste väljad. Alguses on üks tühi seeria; joonis näitab vaadet pärast teise seeria lisamist. |
| **Raskus (kg)** | Kohustuslik arvuväli. Lubatud on null ja positiivsed kümnendarvud, näiteks 2,5. Null tähistab lisaraskuseta seeriat. |
| **Kordused** | Kohustuslik arvuväli. Lubatud on positiivsed täisarvud. |
| **+ Lisa seeria** | Lisab lõppu järgmise numbriga tühja seeria, säilitab olemasoleva sisendi ja viib fookuse uue seeria raskuse väljale. |
| **Salvesta treening** | Esmane tegevus kõigi seeriate järel. Tulevases teostuses kontrollib sisendit ja salvestab valitud harjutuse koos seeriatega. |

Esialgne wireframe näitab ühe harjutuse ja mitme seeria sisestamist. Mitme harjutuse lisamise voog, harjutuste tegelik andmeallikas ning API-integratsioon täpsustatakse hilisema vormi teostuse käigus.

## Tagasiside ja kasutusmugavus

- Sildid asuvad alati väljade kohal; neid ei asenda kohatäitetekst.
- Mobiilis kuvatakse raskuse jaoks kümnendarvude ja korduste jaoks täisarvude sisestamist toetav klaviatuur.
- Puuduv või vigane väärtus saab välja alla tekstilise teate, näiteks „Vali harjutus”, „Sisesta raskus null või suurem” või „Sisesta vähemalt üks kordus”. Fookus liigub esimesele vigasele väljale; sisestatud andmed säilivad.
- Salvestamise ajal on esmase nupu tekst „Salvestan…” ja korduv salvestamine on takistatud.
- Õnnestumise teade: „Treening salvestatud.” Vea korral: „Salvestamine ebaõnnestus. Proovi uuesti.” Vea korral säilib kogu sisend. Need on kavandatud olekud, mitte selle ülesande töötav funktsionaalsus.
- Väljad ja nupud on täislaiuses ning vähemalt 44 px kõrgused. Pikem vorm kerib vertikaalselt; salvestusnupp jääb vormi lõppu ega kata sisestusvälju.
- Klaviatuuri fookus on nähtav ja tabulaator liigub elementide vahel ülevalt alla. Seeriate väljad on eristatavad ka abitehnoloogiale, näiteks „Seeria 2, kordused”.

## Visuaalne suund

- Tume taust ja heledad tekstid, kooskõlas olemasoleva GymLogi kujundusega.
- Neon Lime rõhutab esmase tegevuse nuppu ja fookusolekut; „Lisa seeria” on tagasihoidlikuma piirjoonega teisene nupp.
- Seeriaid eraldavad lihtsad piirjooned ja piisav vaba ruum. Puuduvad pildid, animatsioonid ning detailne dekoratsioon.
- Suuremal ekraanil jääb vorm keskjoondatud piiratud laiusega veeruks.

## Ülevaatuse kontrollnimekiri

- [x] Harjutuse rippmenüü.
- [x] Raskus kilogrammides ja korduste arv.
- [x] Mitme seeria ülesehitus ning nupp „Lisa seeria”.
- [x] Nupp „Salvesta treening”.
- [x] Eestikeelsed sildid ja mobiilist lähtuv paigutus.
- [x] Tume Neon Lime kujundussuund madala detailsusega.

Tulevase Pull Requesti kirjeldus peab sisaldama eraldi rida:

Closes #30
