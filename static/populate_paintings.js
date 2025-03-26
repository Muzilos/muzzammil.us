var paintings = document.getElementById("paintings");
var paintingsInOrder = JSON.parse(getPaintingsInOrder())["paintings"];
console.log(paintingsInOrder);
for (let element in paintingsInOrder) {
  const path = "../paintings/-/" + element;
  const thumbnail_path = "../paintings/-compressed/thumb_" + element;

  // Create the painting container
  var paintingContainer = document.createElement("div");
  paintingContainer.classList.add("painting-container");

  // Create the image link
  var imgLink = document.createElement("a");
  imgLink.href = path;
  imgLink.classList.add("painting-image-link");

  // Create the image element
  var img = document.createElement("img");
  img.classList.add("art");
  img.src = thumbnail_path;
  img.alt = paintingsInOrder[element]["description"];

  // Append the image to the link
  imgLink.appendChild(img);

  // Create the description box (now also acts as a button)
  var descriptionBox = document.createElement("a");
  descriptionBox.classList.add("painting-description");
  descriptionBox.href = "#"; // We'll override this with JavaScript
  
  // Create a span for the description text
  var descriptionText = document.createElement("span");
  descriptionText.classList.add("description-text");
  descriptionText.innerText = paintingsInOrder[element]["description"];
  
  // Create a span for the price
  var priceText = document.createElement("span");
  priceText.classList.add("price-text");
  priceText.innerText = paintingsInOrder[element].price > 0 ? `$${(paintingsInOrder[element].price / 100).toFixed(2)}` : "NFS";  

  // Append description and price to the description box
  descriptionBox.appendChild(descriptionText);
  descriptionBox.appendChild(priceText);

  // Add click event listener to the description box
  if (paintingsInOrder[element].price > 0){
    descriptionBox.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent default link behavior
      initiateCheckout(element, paintingsInOrder[element].price, thumbnail_path);
    });
  }

  // Append the image link and description box to the container
  paintingContainer.appendChild(imgLink);
  paintingContainer.appendChild(descriptionBox);

  // Append the container to the paintings grid
  paintings.appendChild(paintingContainer);
}

function getPaintingsInOrder() {
  const request = new XMLHttpRequest();
  request.open("GET", 'https://eux6cem6swf7jmidokec64pwn40covfu.lambda-url.us-east-1.on.aws/', false); 
  request.send(null);
  if (request.status === 200) {
    console.log(request.responseText);
    return request.responseText;
  }
  return null;
}

async function initiateCheckout(paintingId, price, imagePath) {
  try {
    // Get the full URL of the image
    const fullImageUrl = new URL(imagePath, window.location.origin).href;

    const response = await fetch('https://q6lp56ph6dhosmyn7xh32jyipy0epgjw.lambda-url.us-east-1.on.aws/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: paintingsInOrder[paintingId]["description"],
                images: [fullImageUrl]
              },
              unit_amount: price
            },
            quantity: 1
          }
        ]
      }),
    });

    const { url } = await response.json();
    
    // Redirect to Stripe Checkout
    window.location.href = url;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    alert('There was an error processing your request. Please try again.');
  }
}
