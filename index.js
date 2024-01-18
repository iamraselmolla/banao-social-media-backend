require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// Database connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.q37bxqk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function sendEmail({ mailInput, otpNumber }) {
    return new Promise((resolve, reject) => {
        var transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: 'raselmolla6336@gmail.com',
                pass: process.env.app_pass,
            },
            secure: false,
        });

        const mail_configs = {
            from: 'raselmolla6336@gmail.com',
            to: mailInput,
            subject: "Banao Social Media PASSWORD RECOVERY",
            html:
                `<!DOCTYPE html>
            <html lang="en" >
            <head>
                <meta charset="UTF-8">
                <title>Banao - OTP Email Template</title>
                
            
            </head>
            <body>
            <!-- partial:index.partial.html -->
            <div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
                <div style="margin:50px auto;width:70%;padding:20px 0">
                <div style="border-bottom:1px solid #eee">
                    <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Banao Social Media</a>
                </div>
                <p style="font-size:1.1em">Hi,</p>
                <p>Thank you for using Banao Social Media Platform. Use the following OTP to complete your Password Recovery Procedure.</p>
                <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${otpNumber}</h2>
                <p style="font-size:0.9em;">Regards,<br />Team Banao</p>
                <hr style="border:none;border-top:1px solid #eee" />
                <div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
                    <p>Banao Technologies</p>
                    <p>India</p>
                </div>
                </div>
            </div>
            <!-- partial -->
                
            </body>
            </html>`,
        };
        transporter.sendMail(mail_configs, function (error, info) {
            if (error) {
                console.log(error);
                return reject({ message: `An error has occured` });
            }
            return resolve({ message: "Email sent succesfuly" });
        });
    });
}
async function run() {
    const postsCollection = client.db("atg").collection("posts");
    const usersCollection = client.db("atg").collection("users");
    try {

        // Register User
        app.post('/register', async (req, res) => {
            const { username, email, password } = req.body;
            const foundPrevious = await usersCollection.findOne(
                {
                    $or: [
                        { username: { $eq: username } },
                        { email: { $eq: email } }
                    ]
                }
            );
            if (foundPrevious) {
                return res.status(409).json({ message: 'Already registered' })
            } else {
                const createdAt = new Date().toDateString()
                const hashedPassword = await bcrypt.hash(password, 10);


                const result = await usersCollection.insertOne({ username, email, password: hashedPassword, createdAt });
                res.status(200).json({ message: 'Registration succeed', data: result })
            }


        });

        // Login User
        app.post('/login', async (req, res) => {
            const { username, password } = req.body;

            try {
                const findUser = await usersCollection.findOne({ username });

                if (!findUser) {
                    return res.status(404).json({ message: 'User not found. Please register' });
                }

                const passwordMatch = await bcrypt.compare(password, findUser.password);

                if (passwordMatch) {
                    const { username, _id, createdAt, email } = findUser;

                    const newUserData = { username, _id, createdAt, email };

                    res.status(200).json({ message: 'Login successful 👍', data: newUserData, localid: findUser?._id, token: 'null' });
                } else {
                    res.status(401).json({ message: 'Wrong Password' });
                }
            } catch (error) {
                console.error('Error during login:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
        app.post('/posts', async (req, res) => {
            const data = req.body;
            const result = await postsCollection.insertOne(data);
            res.send(result)
        })
        app.post('/users', async (req, res) => {
            const data = req.body;
            const result = await usersCollection.insertOne(data);
            res.send(result)
        })
        app.get('/posts', async (req, res) => {
            const query = {};
            const result = await postsCollection.find(query).sort({ postedTime: -1 }).toArray();
            res.send(result)
        })

        app.delete('/delete-post/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.deleteOne(query)
            res.send(result)
        });

        app.put('/edit-post/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    postData: req.body.editedPost


                }
            }
            const result = await postsCollection.updateOne(query, updatedDoc, options);
            res.send(result)

        });



        // Comment posting

        app.put('/comment', async (req, res) => {
            const { postId, commentData } = req.body;

            try {
                const result = await postsCollection.updateOne(
                    { _id: new ObjectId(postId) }, // Convert postId to ObjectID
                    { $push: { comments: commentData } }
                );

                if (result.modifiedCount === 1) {
                    res.status(200).json({ message: 'Comment added successfully.' });
                } else {
                    res.status(404).json({ message: 'Post not found.' });
                }
            } catch (error) {
                console.error('Error updating document:', error);
                res.status(500).json({ message: 'Internal server error.' });
            }
        });


        // Update like
        app.put('/like', async (req, res) => {
            const { id, username } = req.body;

            try {
                const post = await postsCollection.findOne({
                    _id: new ObjectId(id),
                    'likes.username': username,
                });

                if (post) {
                    res.status(400).json({ message: 'You have already liked this post.' });
                    return;
                }

                const result = await postsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $push: { likes: username } }
                );

                if (result.modifiedCount === 1) {
                    res.status(200).json({ message: 'Like added successfully.' });
                } else {
                    res.status(404).json({ message: 'Post not found.' });
                }
            } catch (error) {
                console.error('Error updating document:', error);
                res.status(500).json({ message: 'Internal server error.' });
            }
        });

        // Forget PAssword
        app.post("/forget-password", async (req, res) => {
            const { otpNumber, mailInput } = req.body
            const findUser = await usersCollection.findOne({ email: mailInput })
            if (!findUser) {
                return res.status(400).json({ message: 'User not found', statusCode: 400 })
            }

            sendEmail({ mailInput, otpNumber })
                .then((response) => res.send(response.message))
                .catch((error) => res.status(500).send(error.message));


        });


        // Update Password
        app.put('/reset-password', async (req, res) => {
            const { password, email } = req.body;
            const hashedPassword = await bcrypt.hash(password, 10);

            try {
                const result = await usersCollection.updateMany(
                    { email: email },
                    { $set: { password: hashedPassword } },
                    { upsert: true }
                );

                res.status(200).json({ message: 'Password reset successful', statusCode: 200 });
            } catch (error) {
                console.error('Error updating password:', error);
                res.status(500).json({ message: 'Internal server error.' });
            }
        });
    }
    finally {

    }
}
run().catch(e => console.log(e.message))

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})