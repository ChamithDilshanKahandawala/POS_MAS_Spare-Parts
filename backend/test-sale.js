const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZTQwYjIzZDY3NTM1YWFkZDJlYTg2MiIsImlhdCI6MTc3ODgxMTEzMywiZXhwIjoxNzc4ODE0NzMzfQ.wFvXQpBomqp4ifuYAv0qj7IAyOAmRsFfaB91whuE-p0';

async function test() {
  try {
    const mongoose = require('mongoose');
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    const Product = require('./models/Product');
    const product = await Product.findOne({ stock_quantity: { $gt: 0 } });
    if (!product) throw new Error('No product found');
    await mongoose.disconnect();

    const salePayload = {
      items: [
        { product_id: product._id, quantity: 1, discount: 0 }
      ],
      total_discount: 0,
      payment_method: 'Cash',
      sale_source: 'shop',
      customer_name: 'Test Test',
      paid_amount: product.selling_price + 500
    };

    console.log('Creating sale...');
    let res = await fetch('http://localhost:5001/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(salePayload)
    });
    
    let data = await res.json();
    console.log('CREATE Response:', data.change, data.createdAt);
    
    const saleId = data._id;
    console.log('Fetching receipt for sale:', saleId);
    
    let res2 = await fetch('http://localhost:5001/api/sales/' + saleId + '/receipt', {
      headers: { Authorization: 'Bearer ' + token }
    });
    
    let data2 = await res2.json();
    console.log('RECEIPT Response:', data2.change, data2.createdAt);
    
  } catch(err) {
    console.error('Error:', err.message);
  }
}
test();
