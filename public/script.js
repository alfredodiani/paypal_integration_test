

paypal.Buttons({
  createOrder: async (data) => {
    let form = document.getElementById('user-info')
    const resp_body = JSON.stringify({
      items: [
        {
          id: 1,
          quantity: 1,
        },
        {
          id: 2,
          quantity: 1,
        }
      ],
      person: {
        first_name: form.elements['first-name'].value,
        last_name: form.elements['last-name'].value,
        email: form.elements['email'].value,
        phone: form.elements['phone-number'].value,
      },
      address: {
        address_line_1: form.elements['address-line-1'].value,
        address_line_2: form.elements['address-line-2'].value,
        city: form.elements['city'].value,
        state: form.elements['state'].value,
        zip_code: form.elements['zip-code'].value,
        country: form.elements['country'].value,
      }
    })

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: resp_body,
      });

      const orderData = await response.json();

      if (orderData.id) {
        return orderData.id;
      } else {
        const errorDetail = orderData?.details?.[0];
        const errorMessage = errorDetail
          ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
          : JSON.stringify(orderData);

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error(error);
      resultMessage(
        `Could not initiate PayPal Checkout...<br><br>${error}`,
      );
    }
  },
  onApprove: async (data, actions) => {
    try {
      const response = await fetch(
        `/api/orders/${data.orderID}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const orderData = await response.json();

      const errorDetail = orderData?.details?.[0];

      if (errorDetail?.issue === 'INSTRUMENT_DECLINED') {
        return actions.restart();
      } else if (errorDetail) {
        throw new Error(
          `${errorDetail.description} (${orderData.debug_id})`,
        );
      } else if (!orderData.purchase_units) {
        throw new Error(JSON.stringify(orderData));
      }
      else {
        const transaction =
          orderData.purchase_units[0].payments.captures[0];
        console.log(
          'Capture result',
          orderData,
          JSON.stringify(orderData, null, 2),
        );
        window.location.href = "/thankyou";
      }
    } catch (error) {
      console.error(error);
      resultMessage(
        `Sorry, your transaction could not be processed...<br><br>${error}`,
      );
    }
  },
    
})
.render('#paypal-button-container');

function resultMessage(message) {
  const container = document.getElementById('paypal-button-container');
  const p = document.createElement('p');
  p.innerHTML = message;
  container.parentNode.appendChild(p);
}