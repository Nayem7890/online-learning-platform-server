// index.js
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();
const serviceAccount = require("./serviceKey.json");

const app = express();
const port = process.env.PORT || 3000;

// --- Firebase Admin init ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// --- Global middleware ---
app.use(cors());
app.use(express.json());

// --- MongoDB setup ---
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.9puxf5x.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// --- Auth middleware (protected routes only) ---
const middleware = async (req, res, next) => {
  // Allow preflight requests
  if (req.method === "OPTIONS") {
    return next();
  }

  const authorization = req.headers.authorization;

  if (!authorization) {
    return res
      .status(401)
      .send({ message: "Unauthorized: No token provided" });
  }

  const [scheme, token] = authorization.split(" ");

  // Expect "Bearer <token>"
  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .send({ message: "Unauthorized: Invalid auth header format" });
  }

  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.user = decodedUser; // attach user
    return next();
  } catch (error) {
    console.log("Token error:", error.message);
    return res.status(403).send({
      message: "Unauthorized: Invalid or expired token",
    });
  }
};

// --- Public root route (so opening the domain is NOT 401) ---
app.get("/", (req, res) => {
  res.send("SkillSphere API is running 🚀");
});

async function run() {
  try {
    
    // await client.connect();

    const db = client.db("course-db");
    const courseCollection = db.collection("courses");
    const enrolledCollection = db.collection("enrolled");

    // --- PUBLIC: get all courses ---
    app.get("/courses", async (req, res) => {
      try {
        const cursor = courseCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        console.error("GET /courses failed:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // --- PROTECTED: get one course by id ---
    app.get("/courses/:id", middleware, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid course id" });
        }

        const course = await courseCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!course) {
          return res.status(404).send({ message: "Course not found" });
        }

        res.send(course);
      } catch (err) {
        console.error("GET /courses/:id failed:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // --- PROTECTED: update course ---
    app.put("/courses/:id", middleware, async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid course id" });
        }

        const filter = { _id: new ObjectId(id) };
        const update = { $set: updatedData };

        const result = await courseCollection.updateOne(filter, update);
        res.send(result);
      } catch (err) {
        console.error("PUT /courses/:id failed:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // --- PROTECTED: delete course ---
    app.delete("/courses/:id", middleware, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid course id" });
        }

        const filter = { _id: new ObjectId(id) };
        const result = await courseCollection.deleteOne(filter);
        res.send(result);
      } catch (err) {
        console.error("DELETE /courses/:id failed:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    
    app.get("/popular-courses", async (req, res) => {
  try {
    const docs = await courseCollection
      .find({})
      .sort({ "rating.avg": -1, createdAt: -1 })
      .limit(6)
      .toArray();
    res.json(docs);
  } catch (err) {
    console.error("❌ Error fetching popular courses:", err);
    res.status(500).json({ error: "Failed to fetch popular courses" });
  }
});

    // --- PROTECTED: create enrollment ---
    app.post("/my-enrolled-course", middleware, async (req, res) => {
      try {
        const { courseId, studentEmail, studentName, studentPhoto } = req.body;

        if (!courseId || !studentEmail) {
          return res
            .status(400)
            .json({ message: "courseId and studentEmail are required" });
        }

        let courseObjectId;
        try {
          courseObjectId = new ObjectId(courseId);
        } catch (e) {
          return res.status(400).json({ message: "Invalid courseId format" });
        }

        const existingEnrollment = await enrolledCollection.findOne({
          courseId: courseObjectId,
          studentEmail,
        });

        if (existingEnrollment) {
          return res
            .status(409)
            .json({ message: "You are already enrolled in this course" });
        }

        const newEnrollment = {
          courseId: courseObjectId,
          studentEmail,
          studentName,
          studentPhoto,
          enrolledAt: new Date(),
        };

        const result = await enrolledCollection.insertOne(newEnrollment);
        res.status(201).json(result);
      } catch (err) {
        console.error("POST /my-enrolled-course failed:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // --- PROTECTED: get enrolled courses for a student (with course data join) ---
    app.get("/my-enrolled-course", middleware, async (req, res) => {
      try {
        const { studentEmail } = req.query;
        if (!studentEmail) {
          return res.status(400).json({ message: "studentEmail is required" });
        }

        const pipeline = [
          { $match: { studentEmail } },
          { $sort: { enrolledAt: -1 } },
          {
            $lookup: {
              from: "courses",
              localField: "courseId",
              foreignField: "_id",
              as: "course",
            },
          },
          {
            $unwind: {
              path: "$course",
              preserveNullAndEmptyArrays: true,
            },
          },
        ];

        const enrollmentsWithCourseData = await enrolledCollection
          .aggregate(pipeline)
          .toArray();

        res.json(enrollmentsWithCourseData);
      } catch (err) {
        console.error("GET /my-enrolled-course failed:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // --- PROTECTED: add new course ---
    app.post("/courses", middleware, async (req, res) => {
      try {
        const newCourse = req.body;
        const result = await courseCollection.insertOne(newCourse);
        res.send(result);
      } catch (err) {
        console.error("POST /courses failed:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    console.log("Connected to MongoDB and routes are ready ✅");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

run().catch(console.dir);

// --- Local dev only: start server ---
// (Vercel will ignore app.listen and use `module.exports = app` instead)
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// --- Export app for Vercel / other platforms ---
module.exports = app;
