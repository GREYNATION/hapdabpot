import express from 'express';
import helloRouter from './routes/hello.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => { res.send("API is running"); });

app.use('/hello', helloRouter);

app.listen(PORT, () => { console.log('Server running on port ' + PORT); });