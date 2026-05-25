const express = require("express")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const app = express()

app.use(express.json())

const uri = process.env.MONGO_URI || "mongodb://admin:admin123@mongo1:5501,mongo2:5502,mongo3:5503/devopsdb?replicaSet=rs0&authSource=admin"

mongoose.connect(uri)

const User = mongoose.model("User",{
username:String,
password:String
})

app.get("/",(req,res)=>{
res.send("DevOps Project Running")
})

app.post("/register",async(req,res)=>{

const hashed = await bcrypt.hash(req.body.password,10)

const user = new User({
  username: req.body.name,  // "name" field lo request se
  password: hashed
})

await user.save()

res.send("User Registered")

})

app.post("/login",async(req,res)=>{

const user = await User.findOne({username:req.body.username})

if(!user){
return res.send("User not found")
}

const match = await bcrypt.compare(req.body.password,user.password)

if(match){
res.send("Login successful")
}else{
res.send("Invalid password")
}

})

app.listen(3000,()=>{
console.log("Server running")
})

