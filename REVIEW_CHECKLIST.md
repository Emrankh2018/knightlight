# Review checklist

## Italian Game for White (italian-game) - reviewed: false

Chapters and lessons (tick when the coach has checked every move and sentence):

- [ ] 01 The Italian setup
  - [ ] first-moves
  - [ ] development-goals
  - [ ] f7-target
- [ ] 02 Giuoco Piano plans
  - [ ] quiet-d3
  - [ ] center-c3-d4
  - [ ] greed-trap
- [ ] 03 Two Knights Defence
  - [ ] two-knights-idea
  - [ ] fried-liver
  - [ ] polerio-na5
- [ ] 04 Evans Gambit and traps
  - [ ] evans-gambit
  - [ ] legal-mate
  - [ ] shilling-trap
  - [ ] when-to-play

Items needing coach attention:

- [ ] Shilling trap: line is 3...Nd4 4.Nxe5 Qg5 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3#. Mate is machine-checked, but the name "Blackburne Shilling Gambit" is not in the openings dataset (the dataset calls 3...Nd4 "Blackburne-Kostic Gambit"). The nickname appears only in teacher notes. Confirm the name and that the "greedy" claim is fair, since White has other moves on 4 and 5.
- [ ] Legal mate: starts from 2...d6 (not 2...Nc6), so it is a Bc4 trap rather than a pure Italian line. Name "Legal mate" not in the dataset. Confirm it belongs in this course.
- [ ] Fried Liver: taught only to 8.Nc3 with a "sharp fight, not a sure win" note. No evaluation claimed.
- [ ] Polerio (5...Na5) lesson: "White is a pawn up" after 8.Be2 and the 10.Ne5 ending (dataset: Knorre Variation) - confirm wording.
- [ ] Evans Gambit: only the accepted main line 5...Ba5 (dataset: Morphy Attack) is taught; declined lines omitted.
- [ ] Find-move prompts with several reasonable answers (the app expects one move): d3 and d4 in quiet-d3 / center-c3-d4, c3 in greed-trap, Bd2 block, O-O in two lessons. Prompt text names the idea to narrow it down; coach to decide if wording is clear.
- [ ] Omitted - needs coach input: Traxler Counterattack (4.Ng5 Bc5), Max Lange Attack, Evans Gambit declined lines, deeper Fried Liver theory, Giuoco Piano 7.Nc3 / Greco Gambit lines, Jerome Gambit refutation (only the bishop-for-a-pawn point is made).

## Checkmate Patterns (checkmate-patterns) - reviewed: false

Chapters and lessons (tick when the coach has checked every move and sentence):

- [ ] 01 The back-rank mate
  - [ ] back-rank-mate
  - [ ] make-luft
  - [ ] back-rank-trade
- [ ] 02 Mating with rooks and the queen
  - [ ] ladder-mate
  - [ ] queen-king-mate
  - [ ] careful-stalemate
- [ ] 03 The smothered mate
  - [ ] smothered-idea
  - [ ] smothered-trap
- [ ] 04 Quick mates and how to stop them
  - [ ] fools-mate
  - [ ] scholars-mate
  - [ ] stop-scholars-mate

Items needing coach attention:

- [ ] All find-move answers that end in mate were machine-checked as the only mate in one. Not machine-checkable: wording and age level.
- [ ] make-luft and stop-scholars-mate find-move steps have other good answers (g6 / f6 for luft; Qe7 for Scholar's defence). Prompts say so, but the app accepts one move. Coach to decide.
- [ ] smothered-trap uses the same Shilling-style line (3...Nd4 4.Nxe5 Qg5 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3#) as the Italian Game course. Mate is machine-checked; calling 4.Nxe5 "the mistake" and 4.Nxd4 the good reply should be confirmed. No trap name is used.
- [ ] stop-scholars-mate line 3...g6 4.Qf3 Nf6: legal, and Nf6 blocks the f-file. Taught as "Black is fine"; coach to confirm.
- [ ] Fool's mate and Scholar's mate are not in the openings dataset as named lines (dataset lists "Barnes Opening: Fool's Mate" 1.f3 e5 2.g4 Qh4#). Names are used as plain teaching words.
- [ ] Omitted - needs coach input: Philidor's Legacy (queen-sacrifice smothered mate), full king-and-queen "box" technique against a lone king, king-and-rook mate, Anastasia's, Arabian, Boden's and other named mates, Scholar's mate variations with ...Nh6 or ...Qf6 defences.

## Tactics Basics (tactics-basics) - reviewed: false

Chapters and lessons (tick when the coach has checked every move and sentence):

- [ ] 01 Forks
  - [ ] knight-fork
  - [ ] knight-fork-practice
  - [ ] pawn-fork
- [ ] 02 Pins
  - [ ] pin-idea
  - [ ] win-a-pinned-piece
- [ ] 03 Skewers and discovered attacks
  - [ ] skewer
  - [ ] discovered-attack
- [ ] 04 Hanging and defended pieces
  - [ ] hanging-pieces
  - [ ] defended-pieces
  - [ ] safety-check
- [ ] 05 Piece values and trading up
  - [ ] piece-values
  - [ ] trading-up

Items needing coach attention:

- [ ] All positions are hand-built from FENs (no opening names used) except pin-idea, which uses 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5. Machine-checked: every move is legal; after each forking, pinning or skewering move every legal reply still allows the claimed capture. Not machine-checked: wording and age level.
- [ ] Find-move steps accept one answer. Other moves may also be good: for example Bxd7+ style captures in discovered-attack, or alternative king replies. Coach to decide if prompts are clear.
- [ ] Wording "wins X for free" is used where the capture cannot be recaptured. In discovered-attack (Nxd7+ Kxd7) and the trades in trading-up, the text says the net gain in points instead.
- [ ] piece-values find-move (dxe5 taking the queen): Black's rook can take the pawn back on e5. The text says the pawn "wins the queen, worth 9 points".
- [ ] Piece values 1-3-3-5-9 are taught with a note that they are a guide only.
- [ ] Omitted - needs coach input: double attacks with the queen, removing the defender, deflection, back-rank tactics (covered in the checkmate course), overloaded pieces, zwischenzug, named opening traps, tactics puzzles from the Lichess puzzle set.
- [ ] Openings explorer: confirm the ECO volume titles against an ECO source: A Flank openings; B Semi-open games; C Open games and the French Defense; D Closed and semi-closed games; E Indian defences.

## Queen's Gambit for White (queens-gambit) - reviewed: false

- [ ] 01 The big idea
  - [ ] gambit-idea
  - [ ] centre-plan
- [ ] 02 Queen's Gambit Accepted
  - [ ] qga-nf3
  - [ ] qga-e3
- [ ] 03 Queen's Gambit Declined
  - [ ] qgd-main
  - [ ] qgd-pin
  - [ ] qgd-pawns
  - [ ] qgd-d5-warning
- [ ] 04 The Slav and your plans
  - [ ] slav-c6
  - [ ] when-to-play

Items needing coach attention (queens-gambit):

- [ ] Opening names (Queen's Gambit, Accepted, Declined, Slav Defense, Old Variation after 3.e3) match the Lichess index. Lines 1.d4 d5 2.c4 dxc4 3.Nf3 Nf6 4.e3 e6 5.Bxc4 c5 6.O-O, 3.e3 e5 4.Bxc4 exd4 5.exd4 and the Slav line with 5.a4 Bf5 6.e3 are machine-checked for legality only; Black's replies are example moves, not the only ones.
- [ ] qgd-d5-warning is a trap for White (the Elephant-style 6.Nxd5). Legality and the final material count are machine-checked (Black ends a piece up for a pawn in that line). Coach to confirm it suits the class and the wording.
- [ ] Find-move prompts name the task in words (for example "take on c4 with a bishop", "move your f1 bishop to e2"). Other good moves may exist in some positions; coach to check clarity.
- [ ] The pin on f6: the text says the knight "should not move" because Bxd8 would win the queen; the knight is legally free to move (a relative pin). Coach to check wording.
- [ ] Omitted - needs coach input: a trap for Black (for example the 3.e3 b5 4.a4 c6 5.axb5 cxb5 6.Qf3 idea). Not machine-proven to win material against every defence (6...Nc6 holds), so left out. Also omitted: the Albin Counter-Gambit, 3.e4 lines in the Accepted, the Tarrasch, Semi-Slav, Exchange Variation and minority-attack plans.

## Ruy Lopez for White (ruy-lopez) - intermediate, reviewed: false

- [ ] 01 The Ruy Lopez idea
  - [ ] spanish-idea
  - [ ] morphy-defence
- [ ] 02 The Closed Spanish plan
  - [ ] closed-main-line
  - [ ] closed-moves-why
  - [ ] closed-plans
- [ ] 03 The Exchange Variation
  - [ ] exchange-idea
  - [ ] exchange-structure
  - [ ] exchange-grab
- [ ] 04 Berlin, Open Spanish and a trap
  - [ ] berlin-wall
  - [ ] open-spanish
  - [ ] noahs-ark

Items needing coach attention (ruy-lopez):

- [ ] Opening names and lines were matched to the Lichess openings list in this repo: Ruy Lopez, Morphy Defense, Closed (C84-C92), Exchange Variation Normal Variation, Berlin Wall (4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8 9.Nc3 Bd7), Open (6.d4 b5 7.Bb3 d5 8.dxe5 Be6 9.c3), Noah's Ark Trap. All moves replay legally. Not machine-checked: how good each line is, and all wording.
- [ ] exchange-grab: the line 4.Bxc6 dxc6 5.Nxe5 Qd4 6.Nf3 Qxe4+ is shown as "the pawn grab only makes pawns level". Machine-checked: it is legal, 7 pawns each, and the move is check. It is NOT presented as a trap that wins material. Coach to confirm the teaching point and whether other 6th moves for White should be mentioned.
- [ ] noahs-ark: after ...c4 the bishop on b3 has only Ba4 (taken by the b5 pawn) and Bxc4 (retaken by the b5 pawn). Machine-checked from the position. The text says "lost for a pawn or two"; coach to confirm that wording.
- [ ] Find-move prompts each name a single task (bishop to the pinning square, retreat along the same diagonal, take on c6, castle, Re1, h3 to stop ...Bg4, Qxd8+). Other reasonable moves may exist in some positions; coach to decide if prompts are clear.
- [ ] Berlin: 4.d3 (Anti-Berlin) is only mentioned in TeacherNotes; no lesson.
- [ ] Omitted - needs coach input: known trap 3...a6 4.Bxc6 dxc6 5.Nxe5 Qd4 6.Nf3 Qxe4+ 7.Qe2 as a trap (the position is only level in material, so it is taught as "do not grab"); Marshall Attack and anti-Marshall lines; Open Spanish deeper theory and the Tarrasch Trap; Schliemann, Steinitz Deferred, Archangel and Breyer details; the Closed plan after 9.h3 beyond the general ideas (no exact move orders given).

## London System for White (london-system)

Chapters and lessons (tick when the coach has checked every move and sentence):

- [ ] 01 The London idea
  - [ ] london-idea
  - [ ] bishop-first
  - [ ] bishop-early
- [ ] 02 The usual setup
  - [ ] setup-pieces
  - [ ] bishop-and-castle
  - [ ] h3-retreat
- [ ] 03 Black's common replies
  - [ ] reply-c5
  - [ ] reply-bishop
  - [ ] qb6-b2
- [ ] 04 Plans and when to play it
  - [ ] e4-break
  - [ ] ne5-outpost
  - [ ] when-to-play

Items needing coach attention (london-system):

- [ ] Names matched to the Lichess list in this repo: "Queen's Pawn Game: Accelerated London System" (1.d4 d5 2.Bf4) and "Queen's Pawn Game: London System" (1.d4 d5 2.Nf3 Nf6 3.Bf4 c5 4.e3 Nc6 5.Nbd2 e6 6.c3). Later moves (Be7, Bd3, O-O, e4 line, Ne5) are legal but not in the index; they are common-sense setup moves, coach to confirm.
- [ ] qb6-b2: machine-checked that after 1.d4 d5 2.Nf3 Nf6 3.Bf4 c5 4.e3 Qb6 nothing of White guards b2, and after 5.Qc1 the only black capture on b2 is Qxb2, answered by Qxb2. Not engine-checked whether 5.Qc1 is the best reply; the lesson only teaches it as one safe fix. Coach to decide.
- [ ] ne5-outpost: machine-checked that no black piece attacks e5 after 7.Ne5 and that d4 and Bf4 guard it. Not engine-checked for tactics (7...cxd4, 7...Nc6 8.Nxc6 bxc6 is shown as an even trade).
- [ ] e4-break: line 8.e4 dxe4 9.Nxe4 Nxe4 10.Bxe4 is legal; "active pieces, open lines" is a general statement, not engine-checked. Black could also reply 8...cxd4 or 8...Nxe4.
- [ ] reply-bishop: 4...Bd6 (after ...e6) is taught as "trade bishops with Bxd6"; Bg3 is mentioned in TeacherNotes as another fine option.
- [ ] Find-move prompts each name a single task (play the bishop to f4, c3, e3, Bd3, O-O, Bh2, Bxd6, Qc1, e4, Ne5). Other moves may also be playable; coach to confirm clarity.
- [ ] Omitted - needs coach input: the sharp 2.Bf4 c5 3.e3 Qb6 lines (b2 sacrifice, Nc3/Nb5 ideas), the Jobava-style Nc3 variation, the ...Bf5/...Qd7 attack on the bishop with Ne5 tricks, 2...Bf5 mirror lines, Bg3 vs ...Nh5 trade lines, any named traps, the ...Nc6/...Bg4 ideas, and the ...c5 break ...Qb6 + ...Bg4 pins.

## Sicilian Defence for Black (sicilian-defence) - intermediate, reviewed: false

- [ ] 01 Why play the Sicilian?
  - [ ] why-sicilian
  - [ ] c-vs-e-pawn
- [ ] 02 The Open Sicilian
  - [ ] open-main-line
  - [ ] najdorf-intro
  - [ ] dragon-intro
- [ ] 03 Other second moves
  - [ ] nc6-and-e6
  - [ ] alapin
  - [ ] closed-sicilian
- [ ] 04 Plans and habits for Black
  - [ ] d5-break
  - [ ] c-file-plan
  - [ ] habits
  - [ ] when-to-play-sicilian

Items needing coach attention:

- [ ] Opening names were checked against the Lichess index (Sicilian Defense, Modern Variations, Najdorf, Dragon, Yugoslav Attack, Old Sicilian, Alapin, Closed). Lines used: open main line to 5.Nc3; Najdorf 5...a6; Dragon 5...g6 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6; c-file line 9.Bc4 Bd7 10.O-O-O Rc8 (index: Old Line); Alapin 2...d5 3.exd5 Qxd5 4.d4 Nf6 5.Nf3; Closed 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6. All moves replay legally.
- [ ] The text calls the 5.Nc3 position the Open Sicilian. The Lichess index uses "Open" only for the 2...Nc6 line, so coach to confirm the wording.
- [ ] Find-move steps name one task each (for example "push the g-pawn one square" for 5...g6). Other moves may also be good; coach to confirm clarity.
- [ ] General claims (the a6 pawn controls b5, the Dragon bishop uses the long diagonal, White often castles long in the Yugoslav, the c-file is half-open after ...cxd4) are standard ideas, not engine-checked.
- [ ] The Alapin line 5.Nf3 comment suggests ...Bg4 as a normal development; check it fits the level.
- [ ] Omitted - needs coach input: classic traps for White (no trap could be confirmed by machine here), ...Qb6 ideas and the poisoned pawn, Scheveningen and Sveshnikov set-ups, Taimanov and Kan, the Smith-Morra Gambit (1.e4 c5 2.d4), the Rossolimo (3.Bb5), the Moscow 3.Bb5+, the English Attack against the Najdorf, the Yugoslav h4 pawn storm, ...d5 breaks in specific lines.
