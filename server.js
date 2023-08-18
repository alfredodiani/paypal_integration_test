import express from 'express';
import fetch from 'node-fetch';
import 'dotenv/config';
import path from 'path';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 3000 } = process.env;
const base = 'https://api-m.sandbox.paypal.com';
const app = express();

app.use(express.static('public'));
app.use(express.json());

//simulating a database with a array
const storeItems = new Map([
  [1, { price: 15.00, name: "T-Shirt Black M Size" }],
  [2, { price: 20.00, name: "Jeans Skirt S Size"}],
  [3, { price: 18.00, name: "Cargo Pants Camo L size"}]
]);


/**
 * Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
 * @see https://developer.paypal.com/api/rest/authentication/
 */
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error('MISSING_API_CREDENTIALS');
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ':' + PAYPAL_CLIENT_SECRET,
    ).toString('base64');
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      body: 'grant_type=client_credentials',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Failed to generate Access Token:', error);
  }
};

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (orderInfo) => {
  console.log(
    'shopping cart information passed from the frontend createOrder() callback:',
    orderInfo,
  );

  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;
  let total = orderInfo.items.reduce((sum, item) => {
    return sum + storeItems.get(item.id).price * item.quantity
  }, 0)  

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: total,
          breakdown: {
            item_total: {
              currency_code:"USD",
              value: total
            }
          }
        },
        items: orderInfo.items.map(item => {
          const storeItem = storeItems.get(item.id)
          return {
            name: storeItem.name,
            unit_amount: {
              currency_code: "USD",
              value: storeItem.price
            },
            quantity: item.quantity
          }
        }),
        shipping: {
          type: 'SHIPPING',
          name: {
            full_name: orderInfo.person.first_name + " " + orderInfo.person.last_name,
          },
          address: {
            address_line_1: orderInfo.address.address_line_1,
            address_line_2: orderInfo.address.address_line_1,
            admin_area_1: orderInfo.address.state,
            admin_area_2: orderInfo.address.city,
            postal_code: orderInfo.address.zip_code,
            country_code: orderInfo.address.country,
          },
        }
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

//ENDPOINTS

app.post('/api/orders', async (req, res) => {
  try {
    const { body } = req;
    const { jsonResponse, httpStatusCode } = await createOrder(body);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error('Failed to create order:', error);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

app.post('/api/orders/:orderID/capture', async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error('Failed to create order:', error);
    res.status(500).json({ error: 'Failed to capture order.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.resolve('./index.html'));
});

app.get('/thankyou', (req, res) => {
  res.sendFile(path.resolve('./public/thank_you.html'));
});

//LISTEN

app.listen(PORT, () => {
  console.log(`Node server listening at http://localhost:${PORT}/`);
});
