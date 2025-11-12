const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = 3000

// Middleware
app.use(cors());
app.use(express.json())



const uri = "mongodb+srv://online-learning-platform:TPj79a6bReYKbaj9@cluster0.9puxf5x.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    await client.connect();

    const db = client.db("course-db");
    const courseCollection = db.collection("courses");
    const enrolledCollection = db.collection("enrolled");
     


    app.get("/courses", async (req, res) => {
      const result = await courseCollection.find().toArray();
      res.send(result);
    });

    app.get("/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // validate id first
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid course id" });
    }

    const course = await courseCollection.findOne({ _id: new ObjectId(id) });

    if (!course) {
      return res.status(404).send({ message: "Course not found" });
    }

    res.send(course);
  } catch (err) {
    console.error("GET /courses/:id failed:", err);
    res.status(500).send({ message: "Internal server error" });
  }
});

      
     app.put("/courses/:id", async (req, res) => {
  const { id } = req.params;         
  const updatedData = req.body;      

  const objectId = new ObjectId(id);  
  const filter = { _id: objectId };    
  const update = { $set: updatedData }; 

  // Perform the update operation
  const result = await courseCollection.updateOne(filter, update);

  res.send(result);
});

     app.delete("/courses/:id", async (req, res) => {
  const { id } = req.params;         
  const updatedData = req.body;      

  const objectId = new ObjectId(id);  
  const filter = { _id: objectId };    
  const update = { $set: updatedData }; 

  // Perform the update operation
  const result = await courseCollection.deleteOne(filter);

  res.send(result);
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

  app.post("/my-enrolled-course", async (req, res) => {
  try {
    const { courseId, studentEmail, studentName, studentPhoto } = req.body;

    // Basic validation
    if (!courseId || !studentEmail) {
      return res
        .status(400)
        .json({ message: "courseId and studentEmail are required" });
    }

    // --- IMPORTANT: Handle ObjectId ---
    // The 'id' from your frontend is a string.
    // To match it in the database (and for lookups), you must convert it to a MongoDB ObjectId.
    let courseObjectId;
    try {
      courseObjectId = new ObjectId(courseId);
    } catch (e) {
      return res.status(400).json({ message: "Invalid courseId format" });
    }

    // 1. Check if the user is ALREADY enrolled
    const existingEnrollment = await enrolledCollection.findOne({
      courseId: courseObjectId,
      studentEmail: studentEmail,
    });

    if (existingEnrollment) {
      // 409 Conflict: This matches the '409' check on your frontend!
      return res
        .status(409)
        .json({ message: "You are already enrolled in this course" });
    }

    // 2. If not enrolled, create the new enrollment document
    const newEnrollment = {
      courseId: courseObjectId, // Store the ID as an ObjectId
      studentEmail,
      studentName,
      studentPhoto,
      enrolledAt: new Date(), // Add a timestamp for enrollment
    };

    // 3. Insert the new document into the database
    const result = await enrolledCollection.insertOne(newEnrollment);

    // 4. Send a success response
    res.status(201).json(result); // 201 Created is the correct status
  } catch (err) {
    console.error("POST /my-enrolled-course failed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
 
     app.get("/my-enrolled-course", async (req, res) => {
  try {
    const { studentEmail } = req.query;
    if (!studentEmail) {
      return res.status(400).json({ message: "studentEmail is required" });
    }

    // This 'pipeline' is what finds the enrollments AND
    // joins them with the full course details.
    const pipeline = [
      {
        // 1. Find enrollments for the specific student
        $match: { studentEmail: studentEmail },
      },
      {
        // 2. Sort by newest first
        $sort: { enrolledAt: -1 },
      },
      {
        // 3. Join with the 'courses' collection
        $lookup: {
          from: "courses", // The name of your courses collection
          localField: "courseId", // The field on 'enrolledCollection'
          foreignField: "_id", // The field on 'courses' collection
          as: "course", // The name of the new array field to add
        },
      },
      {
        // 4. Unpack the 'course' array into a single object
        $unwind: {
          path: "$course",
          // Keep the enrollment even if the course was somehow deleted
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    // Use the 'enrolledCollection' to run the aggregation
    const enrollmentsWithCourseData = await enrolledCollection
      .aggregate(pipeline)
      .toArray();

    // Send the joined data back to MyEnrolled.jsx
    res.json(enrollmentsWithCourseData);
    
  } catch (err) {
    console.error("GET /my-enrolled-course failed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


    app.post("/courses", async (req, res) => {
  const newCorse = req.body;
  const result = await courseCollection.insertOne(newCorse);
  res.send(result);
   });


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})


