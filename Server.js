const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/loan/apply', (req, res) => 
  console.log(req.body); // Log request body
  const { amount, tenure } = req.body;
  // Business logic for loan approval
  res.send({ message: 'Loan approved!', status: 'success' });
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));
// JavaScript source code
