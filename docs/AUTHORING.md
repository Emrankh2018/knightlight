# Writing a Knightlight course

This guide is for coaches. You do not need to be a programmer. You write plain text files, then run one command that checks them for mistakes.

A course is a folder with one settings file and one or more chapter files.

## 1. Folder layout

```
content/courses/my-first-course/
  course.json          <- the course's title, level and list of chapters
  01-forks.pgn         <- chapter 1
  02-pins.pgn          <- chapter 2
```

- The folder name is the course's short name. Use lowercase words joined by hyphens (`my-first-course`).
- A chapter's name is its file name without `.pgn` (so `01-forks`). Numbers at the start keep files in order.
- Every `.pgn` file in the folder must be listed in `course.json`, and every listed file must exist.

## 2. course.json

```json
{
  "title": "Forks for Beginners",
  "kind": "skills",
  "level": "beginner",
  "description": "Learn to spot and play knight forks.",
  "tags": ["tactics", "knights"],
  "reviewed": false,
  "chapters": [
    { "file": "01-forks.pgn", "title": "Knight forks" },
    { "file": "02-pins.pgn", "title": "Pins" }
  ]
}
```

| Field | Meaning |
|---|---|
| `title`, `description` | Shown to students. Required. |
| `kind` | `"skills"` (themes such as tactics) or `"opening"`. |
| `level` | `beginner`, `intermediate`, `mid-advanced`, `advanced` or `master`. |
| `tags` | Optional list of words used for searching. |
| `reviewed` | `true` or `false` (no quotes). See the rule below. |
| `side` | Optional, for opening courses: `"white"` or `"black"`. |
| `chapters` | The chapter files in the order students see them. |

### The `reviewed` rule

`reviewed` stays **`false`** until you, the coach, have checked every move and every sentence of the course yourself. Do not set it to `true` for anyone else. Courses with `false` are shown as "not yet reviewed".

## 3. Chapter files

A chapter file is a list of "games" in the standard PGN format. In Knightlight **one game is one step** (one screen for the student). Games that share the same `Lesson` tag and sit next to each other form one lesson, in the order they appear.

Each game has two parts: tag lines in square brackets, then a blank line, then the moves.

```
[Lesson "knight-fork"]
[LessonTitle "The knight fork"]
[Step "explain"]

{A knight can attack two pieces at once.}
1. e4 e5 *
```

Leave a blank line between games.

### Tags

Write each tag on its own line as `[Name "value"]`. To put a quote mark inside a value write `\"`, and for a backslash write `\\`.

| Tag | Use | Example |
|---|---|---|
| `Lesson` | **Required.** Short id of the lesson: lowercase words with hyphens, unique in the course. | `[Lesson "knight-fork"]` |
| `LessonTitle` | **Required on the first game of each lesson.** The title students see. | `[LessonTitle "The knight fork"]` |
| `Step` | **Required.** `explain`, `find-move`, `line-drill` or `quiz`. | `[Step "find-move"]` |
| `FEN` | Optional starting position. If missing, the normal starting position is used. Must be a valid FEN. | `[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]` |
| `Side` | `white` or `black`. **Required for `line-drill`.** For `find-move` it is worked out from the FEN; if you write it, it must agree. | `[Side "white"]` |
| `Hint` | A hint. You can use it several times; they are shown in order. `find-move` needs at least one. | `[Hint "Use your knight."]` |
| `TeacherNotes` | Optional talking points for you. Separate several with ` \| ` (space, bar, space). | `[TeacherNotes "Point one \| Point two"]` |
| `Mistakes` | Optional common mistakes to warn about. Same format. | `[Mistakes "Forgetting the knight can jump"]` |
| `ClassQuestions` | Optional questions to ask the class. Same format. | `[ClassQuestions "Which squares does it attack?"]` |
| `Question` | **Quiz only.** The question. | `[Question "Which move wins?"]` |
| `Choices` | **Quiz only.** Answer choices separated by ` \| `. At least 2. | `[Choices "Nf7 \| Nd5 \| Ne6"]` |
| `Answer` | **Quiz only.** The number of the right choice, counting from 1. | `[Answer "1"]` |
| `Explanation` | Optional, quiz only. Shown after the student answers. | `[Explanation "It forks king and rook."]` |

Notes:

- (In the table, `\|` is only there to keep the table tidy. In your file type a plain `|`.)
- `TeacherNotes`, `Mistakes` and `ClassQuestions` can be on any game of a lesson. All of them are collected for the lesson.
- Other tags (such as `Event` or `Site`) are allowed and ignored.

### Moves

- Write moves the usual way: `1. e4 e5 2. Nf3 Nc6`. Black moves after a move number may be written `2... Nc6`.
- Marks such as `!` and `?` and numeric codes such as `$1` are accepted and ignored.
- The game ends with a result: `*`, `1-0`, `0-1` or `1/2-1/2`. Use `*` if you do not care.
- Every move must be legal. The checker plays them one by one.
- **Variations in parentheses `( ... )` are not allowed.** Make a separate game (step) for each line.

### Comments, arrows and highlights

Put text in curly braces `{like this}`.

- A comment **before the first move** is shown on the starting position (the introduction of the step).
- A comment **after a move** is shown when that move is played.

Inside a comment you can draw on the board:

- Arrows: `[%cal Ge2e4,Rd1d8]` means a green arrow from e2 to e4 and a red arrow from d1 to d8.
- Highlighted squares: `[%csl Rd5,Ge4]` means d5 in red and e4 in green.

Colors: **G** green, **R** red, **Y** yellow, **B** blue. These commands are removed from the text students read.

```
{Look at the knight. [%cal Gf3e5] [%csl Re5]}
1. Nf3 *
```

## 4. The four step types

### explain

Shows moves with comments. It may have zero or more moves.

```
[Lesson "knight-fork"]
[LessonTitle "The knight fork"]
[Step "explain"]
[TeacherNotes "Knights jump over pieces | A fork attacks two pieces at once"]

{Here the knight will land on f7. [%csl Rf7]}
1. e4 e5 2. Nf3 d6 3. Nxe5 {The knight takes a pawn. [%cal Ge5f7]} *
```

### find-move

The student must find the move. The first move in the game is the answer. If you add more moves, they alternate: the student's move, the opponent's reply, the student's move, and so on. The line **must end on the student's move**, so the number of moves is odd (1, 3, 5...). At least one `Hint` is required.

```
[Lesson "weak-f7"]
[LessonTitle "Attacking f7"]
[Step "find-move"]
[FEN "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"]
[Hint "Use your queen."]
[Hint "Look at the f7 square."]

{White to move. Find the strongest move.}
4. Qxf7# {Checkmate.} 1-0
```

**Hint ladder.** Write hints from vague to precise:

1. Hint 1 names the piece ("Use the knight.").
2. Hint 2 names the square ("Move it to c7.").
3. After the last hint the app shows the move itself.

### line-drill

The student plays one side of a whole line from memory and the app plays the other side. `Side` is required (the student's side) and there must be at least 2 moves.

```
[Lesson "italian-start"]
[LessonTitle "Starting the Italian"]
[Step "line-drill"]
[Side "white"]
[Hint "Control the center with a pawn."]

{Play the first moves as White.}
1. e4 e5 2. Nf3 Nc6 3. Bc4 *
```

### quiz

A multiple-choice question about the position at the end of the moves (or the starting position if there are no moves). `Question`, `Choices` and `Answer` are all required. `Answer` counts from 1.

```
[Lesson "knight-fork"]
[LessonTitle "The knight fork"]
[Step "quiz"]
[Question "Which side moves next?"]
[Choices "White | Black"]
[Answer "2"]
[Explanation "After 1. e4 it is Black's turn."]

1. e4 *
```

## 5. Putting a lesson together

A lesson is simply several games in a row with the same `Lesson` tag. Write `LessonTitle` on the first one only.

```
[Lesson "knight-fork"]
[LessonTitle "The knight fork"]
[Step "explain"]

{...}
1. e4 *

[Lesson "knight-fork"]
[Step "quiz"]
[Question "..."]
[Choices "a | b"]
[Answer "1"]

*
```

Keep all games of one lesson together. If a lesson id appears again after a different lesson, the checker reports a duplicate.

## 6. Checking and building

Run these in a terminal inside the project folder.

```
npm run validate:content
```

Checks every course and lists each problem as `file[#game]: message`. `#2` means the second game in that file. At the end it prints how many courses, chapters, lessons and steps it found. It stops with an error if anything is wrong. Run it after every edit.

```
npm run data:content
```

Builds the files the app reads (in `public/data/courses/`). It refuses to build if there is any problem, so run `validate:content` first and fix everything.

## 7. Common errors

| Message | What to do |
|---|---|
| `Illegal or unreadable move "Nf6" after 3 move(s)` | That move is not legal in the position (or is mistyped). Check spelling and the board. |
| `Invalid FEN: ...` | The `FEN` tag is not a valid position. Copy it from a board editor. |
| `Variations ( ... ) are not supported` | Remove the parentheses and make a separate game for the other line. |
| `Missing [Lesson] tag` | Every game needs a `Lesson` tag. |
| `Missing [LessonTitle] on the first game of the lesson` | Add `LessonTitle` to the first game of that lesson. |
| `Unknown [Step "..."]` | Use `explain`, `find-move`, `line-drill` or `quiz`. |
| `find-move needs at least one [Hint]` | Add a `Hint` tag. |
| `find-move must end on the solver's move` | Make the number of moves odd, ending on the student's move. |
| `line-drill needs a [Side] tag` | Add `[Side "white"]` or `[Side "black"]`. |
| `[Answer "4"] is out of range` | `Answer` counts from 1 and must not exceed the number of choices. |
| `quiz needs [Choices ...]` | Add `Choices` with at least two options separated by ` \| `. |
| `Duplicate lesson id` | Two different lessons use the same id, or one lesson's games are not together. |
| `Chapter file listed in course.json was not found` | The file name in `course.json` does not match a file in the folder. |
| `"reviewed" is required and must be true or false` | Write `"reviewed": false` without quotes around `false`. |
| `course.json is not valid JSON` | Look for a missing comma or quote mark. |
