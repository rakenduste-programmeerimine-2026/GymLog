# Treeningukalendri wireframe

Seotud ülesanne: [#31 – Frontend: Wireframe – stats/calendar screen](https://github.com/rakenduste-programmeerimine-2026/GymLog/issues/31).

Madala detailsusega mobiilivaade: kasutaja näeb treeningupäevi, valib kuupäeva ja avab selle päeva treeningu [detailvaate](./workout-detail-wireframe.md). Kõik andmed on näited. Dokument ei määra API vastust ega andmebaasi skeemi ning ei lisa töötavat funktsionaalsust.

## Mobiilivaade

```text
┌─────────────────────────────────────┐
│ GymLog                              │
│ Treeningukalender                    │
│                                     │
│ [ ‹ ]    November 2026       [ › ]   │
│                                     │
│   E    T    K    N    R    L    P    │
│                                 1   │
│   2    3    4●   5    6    7    8   │
│   9   10   11●  12   13   14   15   │
│  16   17  [18●] 19   20   21   22   │
│  23   24   25   26   27   28   29   │
│  30                                 │
│                                     │
│ ● Treeninguga päev                  │
│ [ ] Valitud päev                    │
│                                     │
│ 18. november 2026                   │
│ 2 treeningut                        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Treening 1                      │ │
│ │ Kükk, lamades surumine          │ │
│ │ [ Vaata treeningut → ]          │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Treening 2                      │ │
│ │ Jõutõmme                       │ │
│ │ [ Vaata treeningut → ]          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

„Treening 1” ja „Treening 2” on selle päeva loendi kuvatavad järjekorranimed, mitte nõue salvestada treeningu pealkirja või kindlat identifikaatorit.

## Navigeerimine ja olekud

- Noolte ligipääsetavad nimed on „Eelmine kuu” ja „Järgmine kuu”. Need muudavad nähtavat kuud; valitud kuupäev ning selle loend säilivad kuni uue päeva valimiseni. Kui valik jääb teise kuusse, on loendi kohal endiselt täielik kuupäev.
- Päeva valimine uuendab allolevat kuupäeva ja treeningute loendit. Valitud päev eristub piirjoonega; treeningupäeva märgistab eraldi täpp. Üks päev võib olla korraga valitud ja treeninguga.
- „Vaata treeningut” avab vastava treeningu detailvaate. Tagasi tulles taastuvad nähtav kuu, valitud päev ja kerimiskoht.
- Päev ilma treeninguteta: kuupäeva all kuvatakse „Sellel päeval pole treeninguid.”
- Kuu ilma treeninguteta: kalendri all kuvatakse „Sel kuul pole treeninguid.” Päevi saab endiselt valida.
- Tulevase andmete laadimise olek: „Laadin treeninguid…”. Vea korral: „Treeninguid ei saanud laadida.” ja „Proovi uuesti”. Laadimisviga ei kuvata tühja ajaloo pähe.

## Mobiil ja ligipääsetavus

- Üks veerg: kuu navigeerimine, kalender, märgiste selgitus, valitud päeva loend. Päevade nädal algab esmaspäevaga. Horisontaalset kerimist ei ole; treeningukaardid paiknevad üksteise all.
- Kalendri seitse võrdset veergu mahuvad 320 px ekraanile umbes 44 px laiuste päevanuppudena, kui kalendri külgede vahe on väike. Päevanupud ja muud tegevused on vähemalt 44 px kõrgused; kuu navigeerimise nupud vähemalt 44 × 44 px.
- Märgistus ei sõltu ainult värvist: täpp näitab treeningut, piirjoon valikut, legend selgitab mõlemat. Ekraanilugeja päevanimi sisaldab täielikku kuupäeva ja olekut, näiteks „18. november 2026, 2 treeningut, valitud”.
- Päevade lühenditel on abitehnoloogia jaoks täisnimed. Kuu muutus ja valitud päeva kokkuvõte antakse teada ka ekraanilugejale.
- Kõik tegevused on klaviatuuriga kasutatavad nähtava fookusega. Treeningulingi ligipääsetav nimi eristab loendi kirjeid, näiteks „Vaata 18. novembri treeningut 1”.

## Visuaalne suund

Tume taust, hele tekst, lihtsad piirjooned ja piisav vaba ruum. Neon Lime rõhutab treeningupäeva täppi, valitud päeva piirjoont ja fookust. Täpne tüpograafia ning dekoratsioon jäävad hilisema teostuse jaoks.

Tulevase Pull Requesti kirjeldus peab sisaldama eraldi rida:

Closes #31
