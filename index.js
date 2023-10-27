const express = require('express');
const cors = require('cors');
const  mongoose  = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js')
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');
const Booking = require('./models/Booking.js');
const { resolve } = require('path');
require('dotenv').config();
const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = 'asdsaewefwfds';

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname+'/uploads'));
app.use(cors());

mongoose.connect(process.env.MONGO_URL);

function getUserDataFromReq(req){
    return new Promise((resolve, reject) => {
     jwt.verify(req.cookies.token, jwtSecret, {}, async(err,userData) => {
         if(err) throw err;
         resolve(userData);
     });
    });
 }

app.get('/test',(req,res)=>{
    res.json('test ok');
});

app.post('/register', async (req,res)=>{
    const{name,email,password} = req.body;
    try{
        const userDoc = await User.create({
            name,
            email,
            password:bcrypt.hashSync(password, bcryptSalt),
        });
        res.json(userDoc);
    }catch(e){
        res.status(422).json(e);
    }
});

app.post('/login',async (req,res) => {
    const {email,password} = req.body;
    const userDoc = await User.findOne({email});
    if(userDoc){
        const passOk = bcrypt.compareSync(password,userDoc.password);
        if(passOk){
            jwt.sign({
                email:userDoc.email, 
                id:userDoc._id}, 
                jwtSecret, {}, (err,token) => {
                if(err) throw err;
                res.cookie('token',token).json(userDoc);
            });
        }else{
            res.status(422).json('pass not ok');
        }
    }else{
        res.json('not found');
    }
});

app.get('/profile',(req,res)=>{
    const {token} = req.cookies;
    if(token){
        jwt.verify(token,jwtSecret,{}, async(err,userData)=>{
            if(err) throw err;
            const {name,email,_id} = await User.findById(userData.id);
            res.json({name,email,_id});
        });
    }else{
        res.json(null);
    }
});

app.post('/logout',(req,res) => {
    res.cookie('token','').json(true);
})

app.post('/upload-by-link',async(req,res) => {
   const {link} = req.body;
   const newName = 'photo' + Date.now() + '.jpg';
   await imageDownloader.image({
    url:link,
    dest:  __dirname + '/uploads/' +newName,
   });
   res.json(newName);
});

const photosMiddleware = multer({dest: 'uploads/'});
app.post('/upload',photosMiddleware.array('photos',100),(req,res) => {
    const uploadedFiles =[];
    for(let i=0; i<req.files.length; i++){
    const{path, originalname} = req.files[i];
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace('uploads\\',''));
  }
    res.json(uploadedFiles);
});

app.post('/places',(req, res) => {
    const {token} = req.cookies;
    const {
        title, address, addedPhotos, description,price,
        perks, extraInfo, checkIn, checkOut, maxGuests,
    } = req.body;
    jwt.verify(token, jwtSecret, {}, async(err,userData) => {
        if(err) throw err;
        const placeDoc =  await Place.create({
        owner: userData.id,
        title, address, photos:addedPhotos, description,price,
        perks, extraInfo, checkIn, checkOut, maxGuests,
        });
        res.json(placeDoc);
    });
});

app.post('/user-places',async(req,res) => {
    const{token} = req.cookies;
    const {email} = req.body
    const userDoc = await User.findOne({email});
    res.json(await Place.find({owner:userDoc.id}));
    // jwt.verify(token, jwtSecret, {}, async(err,userData) => {
    //     const{id} = userData;
    //     res.json(await Place.find({owner:id}));
    // });

});

app.get('/places/:id', async(req,res) => {
    const{id} = req.params;
    res.json(await Place.findById(id));
});

app.put('/places',async(req,res) =>{
    const {token} = req.cookies;
    const {
        id, title, address, addedPhotos, description,
        perks, extraInfo, checkIn, checkOut, maxGuests, price,
    } = req.body;
    jwt.verify(token, jwtSecret, {}, async(err,userData) => {
        if(err) throw err;
        const placeDoc = await Place.findById(id);
        if(userData.id === placeDoc.owner.toString()){
            placeDoc.set({
                    title, address, photos:addedPhotos, description,
                    perks, extraInfo, checkIn, checkOut, maxGuests,price,
            });
           await placeDoc.save();
            res.json('ok');
        }
    });

});

app.get('/places', async(req,res) => {
    res.json(await Place.find() );
});

app.post('/bookings',async(req,res) => {
    console.log("insight booking")
    const{
        place,email, checkIn, checkOut, numberOfGuests, name, phone, price
    } = req.body;
    // console.log(req.body)
    const userDoc = await User.findOne({email});
    Booking.create({ 
        place, checkIn, checkOut, numberOfGuests, name, phone, price,
        user:userDoc.id,
    }).then((doc) => {
        console.log("insight booking then block")
        res.json(doc);
    }).catch((err) => {
        console.log(err+"insight booking cache block");
    });
});


app.post('/bookingss',async(req,res) => {
    // const userData = await getUserDataFromReq(req);
    const {email} = req.body
    const userDoc = await User.findOne({email});
    res.json( await Booking.find({user:userDoc.id}).populate('place'))
});

app.listen(4000,()=>{
    console.log('Server is Running')
});