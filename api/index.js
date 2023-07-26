const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');

//DB models
const User = require('./models/User');
const Post = require('./models/Post')

const salt = bcrypt.genSaltSync(10);
const secret = 'qwerasdf';  //to read jwt token. Therefore can only be read at the backend side
//Info stored in the encrypted cookies can be read under preview because of this secret key

const app = express();

//middleware
app.use(cors({credentials:true,origin:'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

//DB Connection
mongoose.connect('mongodb+srv://dhruveel10:apple mango@cluster0.akyj4vi.mongodb.net/?retryWrites=true&w=majority')

//To register
app.post('/register', async (req,res) => {
    const {username,password} = req.body;
    try{
      const userDoc = await User.create({
        username,
        password:bcrypt.hashSync(password,salt),
      });
      res.json(userDoc);
    } catch(e) {
      console.log(e);
      res.status(400).json(e);
    }
  });

  //To login
  app.post('/login', async (req,res) => {
    const {username,password} = req.body;
    const userDoc = await User.findOne({username});
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      // logged in
      jwt.sign({username,id:userDoc._id}, secret, {}, (err,token) => {
        if (err) throw err;
        res.cookie('token', token).json({
          id:userDoc._id,
          username,
        });
      });
    } else {
      res.status(400).json('wrong credentials');
    }
  });

  //For cookies
  app.get('/profile', (req,res) => {
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, (err,info) => {
      if (err) throw err;
      res.json(info);
    });
  });

  //To Logout
  app.post('/logout', (req,res) => {
    res.cookie('token', '').json('ok');
  });


  //Creating a new post
  app.post('/post',uploadMiddleware.single('file'), async (req,res) => {
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path+'.'+ext;
    fs.renameSync(path, newPath);

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {
        if (err) throw err;

        const {title,summary,content} = req.body;
        const postDoc = await Post.create({
        title,
        summary,
        content,
        cover:newPath,
        author:info.id,
        });
        res.json(postDoc);
    });
});

    //Editing a post
    app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
        let newPath = null;
        if (req.file) {
          const {originalname,path} = req.file;
          const parts = originalname.split('.');
          const ext = parts[parts.length - 1];
          newPath = path+'.'+ext;
          fs.renameSync(path, newPath);
        }
      
        const {token} = req.cookies;
        jwt.verify(token, secret, {}, async (err,info) => {
          if (err) throw err;
          const {id,title,summary,content} = req.body;
          const postDoc = await Post.findById(id);
          const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
          if (!isAuthor) {
            return res.status(400).json('you are not the author');
          }
          await Post.updateOne(
            { _id: id, author: info.id },
            {
              title,
              summary,
              content,
              cover: newPath ? newPath : postDoc.cover,
            }
          );
          
      
          res.json(postDoc);
        });
      
      });
  
  //Displaying latest 20 posts  
  app.get('/post', async (req,res) => {
    res.json(
      await Post.find()
         .populate('author', ['username'])
         .sort({createdAt: -1})
         .limit(20)
    );
  });
  
  //Checking individual post
  app.get('/post/:id', async (req, res) => {
    const {id} = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
  })

app.listen(4000);