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


