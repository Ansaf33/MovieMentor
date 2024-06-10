import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import {MongoClient} from "mongodb";
import env from "dotenv";

env.config();

// ----------------------------------------------------------------------------------------------- CONSTANTS
var name;
var genre;
const userURL = process.env.MONGO_URL;
const client = new MongoClient(userURL);

let Cart=[];
let cartPrice = 0;

// ----------------------------------------------------------------------------------------------- CONNECTING TO MOVIELIST

let db;
let users;
let purchases;
let movielist;

const saltRounds = 10;
const port = 3000;
const app = express();


app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));

async function run(){
  await client.connect();
  db = client.db('db');
  movielist = db.collection('movielist');
  users = db.collection('users');
  purchases = db.collection('purchases');
  app.listen(port,()=>{
    console.log("Connected to database and Listening to port " + port);
  });
}

run();



// ----------------------------------------------------------------------------------------------- GET REQUESTS

app.get("/",(req,res)=>{
  res.render("home.ejs");
});

app.get("/login",(req,res)=>{
  res.render("login.ejs",{
    text:"..."
  });
})

app.get("/register",(req,res)=>{
  res.render("register.ejs",{
    text:"..."
  });
})

app.get("/front",(req,res)=>{
  if( name != null ){
    name = capitalizeFirstLetter(name);
    res.render("front.ejs",{
      name:name
    });
  }
  else{
    res.redirect("/");
  }
})

app.get("/goals",(req,res)=>{
  res.render("goals.ejs");
})

app.get("/contact",(req,res)=>{
  res.render("contact.ejs");
})

app.get("/genre",(req,res)=>{
  res.render("moviegenre.ejs");
})

app.get("/movielist",async(req,res)=>{
  const response = await movielist.find({genres:genre});
  var title = [];
  var year = [];
  var plot = [];
  var director = [];
  var id = [];
  var cost = [];

  await response.forEach((single)=>{
    title.push(single.title);
    year.push(single.year);
    plot.push(single.plot);
    director.push(single.director);
    id.push(single.id);
    cost.push(single.cost);
  });

  if( name == null ){
    res.redirect("/");
  }
  else{

    res.render("movielist.ejs",{
      title:title,
      year:year,
      plot:plot,
      director:director,
      length:plot.length,
      id:id,
      cost:cost
    });

}
})


app.get("/cart",(req,res)=>{
  if( name != null ){
    res.render("cart.ejs",{
      data:Cart,
      total:cartPrice
    });
  }
  else{
    res.redirect("/");
  }

});

app.get("/purchases",async(req,res)=>{

  if( name == null ){
    res.redirect("/");
  }
  else{
    var allPurchases = await purchases.find({name:name});

    var purchaseName = [];
    var purchaseTitle = [];
    var purchaseDay = [];
    var purchaseHour = [];
    var purchaseMinute = [];
    var purchaseCost = [];
    var total = 0;

    await allPurchases.forEach((purchase)=>{
      purchaseName.push(purchase.name);
      purchaseTitle.push(purchase.title);
      purchaseDay.push(purchase.day);
      purchaseHour.push(purchase.hour);
      purchaseMinute.push(purchase.minute);
      purchaseCost.push(purchase.cost);
      total+=purchase.cost;

    });


    res.render("purchases.ejs",{
      name:purchaseName,
      title:purchaseTitle,
      day:purchaseDay,
      hour:purchaseHour,
      minute:purchaseMinute,
      cost:purchaseCost,
      total:total
    });

}

  
})

app.post("/purchases",async(req,res)=>{
  // ADD THE LIST OF ITEMS IN THE CART TO THE PURCHASES COLLECTION IN DATABASE

  cartPrice = 0;

  if( name == null ){
    res.redirect("/");
  }
  else{

    if( Cart.length != 0 ){

      Cart.forEach((item)=>{
        item.day = new Date().getDay();
        item.hour = new Date().getHours();
        item.minutes = new Date().getMinutes();
      })

      await purchases.insertMany(Cart);
      Cart = [];

      res.redirect("/purchases");

    }
    else{
      res.render("cart.ejs",{
        data:Cart
      });
    }
    
    

}

 
})

//  ----------------------------------------------------------------------------------------------- POSTING REGISTER ie INSERTING DATA INTO THE users

app.post("/register",async(req,res)=>{

  const enteredUsername=req.body.username;
  name = enteredUsername;
  const enteredPassword=req.body.password;


  // CHECK IF USERNAME ALREADY EXISTS
  const response = await users.find({username:enteredUsername});

  var listofusers = [];
  await response.forEach((single)=>{
    listofusers.push(single.username);
  });


  // USER DOES NOT EXIST, SO CAN REGISTER

  if( listofusers.length == 0 ){
    // ENCRYPT PASSWORD AND STORE IT
    bcrypt.hash(enteredPassword,saltRounds,async(err,hash)=>{
      await users.insertMany([{
        username:enteredUsername,
        password:hash
      }]);
      res.redirect("/front");
    });
    
  }

  // USER EXISTS, DO NOT REGISTER HIM

  else{
    res.render("register.ejs",{
      text:"User already exists. Perhaps try the login page?"
    });

  }
})


// ----------------------------------------------------------------------------------------------- POST LOGIN ie CHECK IF USER IS PRESENT IN THE DATABASE

app.post("/login",async(req,res)=>{
  const enteredUsername = req.body.username;
  name = enteredUsername;
  const enteredPassword = req.body.password;

  const response = await users.find({username:enteredUsername});

  var insertedPWD = [];

  await response.forEach((single)=>{
    insertedPWD.push(single.password);
  })



  // IF USER DOES NOT EXISTS
  if( insertedPWD.length == 0 ){
    res.render("login.ejs",{
      text:"User does not exist. Perhaps try the Register Page?"
    })
  }
  
  // IF USER EXISTS, CHECK PASSWORD
  else{
    // COMPARE ENTEREDPASSWORD(NORMAL) AND INSERTEDPWD(ENCRYPTED)
    bcrypt.compare(enteredPassword,insertedPWD[0],(err,result)=>{
      if( err ){
        console.log(err);
      }
      else{

        if( result ){
          res.redirect("/front");
        }
        else{
          res.render("login.ejs",{
            text:"Incorrect Password. Brrr"
          })
        }
        
      }
    })
  }
})


// ----------------------------------------------------------------------------------------------- POSTING TO GET MOVIE LIST

app.post("/genre",async(req,res)=>{
  genre = Object.keys(req.body)[0];
  res.redirect("/movielist");
});

// ----------------------------------------------------------------------------------------------- POSTING ADD TO CART


app.post("/add",async(req,res)=>{

  if( name != null ){
    const movieID = parseInt(Object.keys(req.body)[0]);

    const response = await movielist.find({id:movieID});

    var title;
    var cost;

    await response.forEach((single)=>{
      title = single.title;
      cost = single.cost;
    });

    cartPrice+=cost;

    const date = new Date();

    Cart.push({
      name:name,
      id:movieID,
      title:title,
      day:date.getDay(),
      hour:date.getHours(),
      minute:date.getMinutes(),
      cost:cost
      
    });




    res.status(204).send();

  }
  else{
    res.redirect("/");
  }

})

app.post("/remove",async(req,res)=>{
  const movieID = parseInt(Object.keys(req.body)[0]);

  var deleted = 0;

  Cart.forEach((item, index) => {
    if (item.id == movieID && deleted == 0) {
      cartPrice-=item.cost;
        Cart.splice(index, 1);
        deleted++;
    }
  });




  res.status(204).send();

});


// ----------------------------------------------------------------------------------------------- MISC FUNCTIONS

// CAPITALIZE FIRST LETTER

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}



