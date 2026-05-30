import express from "express";
import path from "path";
import { Game, Studio, Developer } from "./types";
import { MongoClient,Collection,ObjectId } from "mongodb";
import session, { Session } from "express-session";
import "dotenv/config";
import { requireLogin, requireAdmin } from "./middleware/auth";
import sessionMiddleware from "./middleware/session";
import bcrypt from "bcrypt"

const app = express();
const PORT = process.env.PORT || 3000;;
type User = {
  _id?: ObjectId;
  username: string;
  password: string;
  role: "ADMIN" | "USER";
};

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI ontbreekt in .env");
}

const client = new MongoClient(mongoUri);
const db = client.db("GameProject");

let gamesCollection: Collection<Game>;
let studiosCollection: Collection<Studio>;
let usersCollection: Collection<User>;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static("public"));
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});
app.use(express.urlencoded({ extended: true }));
type SortOn = "id" | "title" | "price";

async function seedUsers() {

  const count = await usersCollection.countDocuments();


  if (count > 0) return;

  const adminPass = await bcrypt.hash("admin123", 10);
  const userPass = await bcrypt.hash("user123", 10);

  await usersCollection.insertMany([
    {
      username: "admin",
      password: adminPass,
      role: "ADMIN",
    },
    {
      username: "user",
      password: userPass,
      role: "USER",
    },
  ]);

  console.log("Default users toegevoegd");
}


async function seedDatabase() {
  const gamesCount = await gamesCollection.countDocuments();
  const studiosCount = await studiosCollection.countDocuments();

  if (gamesCount > 0 && studiosCount > 0) return;

  const gamesRes = await fetch(
    "https://raw.githubusercontent.com/Alieu-09/Game-JSON/main/game.json"
  );
  const studiosRes = await fetch(
    "https://raw.githubusercontent.com/Alieu-09/Game-JSON/main/studio.json"
  );

  const games = await gamesRes.json();
  const studios = await studiosRes.json();

  await gamesCollection.insertMany(games);
  await studiosCollection.insertMany(studios);

  console.log("Database seeded");
}


app.get("/", (req, res) => {
  res.redirect("/games");
});

app.get("/admin", requireAdmin, async(req, res) => {
  const games = await gamesCollection.find().toArray();
  res.render("pages/admin",{games});
});

app.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/games");
  res.render("pages/register");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const exists = await usersCollection.findOne({ username });

  if (exists) {
    return res.send("Username bestaat al");
  }

  const hashed = await bcrypt.hash(password, 10);

  await usersCollection.insertOne({
    username,
    password: hashed,
    role: "USER",
  });

  res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/games");

  res.render("pages/login");
});
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await usersCollection.findOne({ username });

    if (!user) {
    res.status(404).json({ message: "Deze gebruikersnaam bestaat niet." });
    return;
  }

  const PasswordMatch = await bcrypt.compare(password, user.password)

    if (!PasswordMatch) {
    res.status(401).json({ message: "Fout wachtwoord." });
    return;
  }

  req.session.user = {
    _id: user._id!.toString(),
    username: user.username,
    role: user.role,
  };

  res.redirect("/games");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.get("/games",requireLogin, async(req, res) => {
   const search = String(req.query.search || "");

  let query: any = {};

  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  let games = await gamesCollection.find(query).toArray();

  const sort = req.query.sort as SortOn;
  const order = req.query.order as "asc" | "desc";

  if (sort) {
    games.sort((a, b) => {
      const ValueA = a[sort];
      const ValueB = b[sort];

      return order === "desc" ? (ValueB > ValueA ? 1 : -1) : (ValueA > ValueB ? 1 : -1);
    });
  }

  res.render("pages/index", {
    games,
    search,
    user: req.session.user
  });
});


app.get("/games/:id", async(req, res) => {
 const game = await gamesCollection.findOne({ id: req.params.id });

  if (!game) return res.status(404).send("Game niet gevonden");

  res.render("pages/detail", { game });
});

app.get("/studio", async (_req, res) => {
  const studios = await studiosCollection.find().toArray();

  const games = await gamesCollection.find().toArray();

  const result = studios.map((studio) => {
    const studioGames = games.filter((game) =>
      studio.notableGamesIds?.includes(game.id)
    );

    return {
      ...studio,
      games: studioGames,
    };
  });

  res.render("pages/studio", { studios: result });
});

app.get("/studio/:id", async (req, res) => {
  const studio = await studiosCollection.findOne({ id: req.params.id });

  if (!studio) return res.status(404).send("Studio niet gevonden");

  const studioGames = await gamesCollection
    .find({ "developer.id": studio.id })
    .toArray();

  res.render("pages/detail-studio", {
    studio,
    studioGames,
  });
});

app.get("/admin/edit/:id", requireAdmin, async (req, res) => {
  const game = await gamesCollection.findOne({ id: req.params.id });

  if (!game) return res.status(404).send("Game niet gevonden");

  res.render("pages/edit", { game });
});

app.post("/admin/edit/:id", requireAdmin, async (req, res) => {
  const { title, price, genre } = req.body;

  await gamesCollection.updateOne(
    { id: req.params.id },
    {
      $set: {
        title,
        price: Number(price),
        genre,
      },
    }
  );

  res.redirect("/admin");
});


async function startServer() {
  await client.connect();
  usersCollection = db.collection<User>("users");
  gamesCollection = db.collection<Game>("games");
  studiosCollection = db.collection<Studio>("studios");

  await seedUsers();
  await seedDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();