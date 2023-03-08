const paintingsInOrder = {
  // "CamScanner 05-12-2021 08.55_1.jpg": "",
  "CamScanner 03-08-2023 00.44_22~3.jpg": "",
  "CamScanner 03-08-2023 00.44_26 (1).jpg": "",
  "CamScanner 03-08-2023 00.44_11.jpg": "",
  "CamScanner 03-08-2023 00.44_1.jpg": "",
  // "CamScanner 03-08-2023 00.44_10.jpg": "",
  "CamScanner 03-08-2023 00.44_12.jpg": "",
  "CamScanner 03-08-2023 00.44_13.jpg": "",
  "CamScanner 03-08-2023 00.44_14.jpg": "",
  "CamScanner 03-08-2023 00.44_16.jpg": "",
  "CamScanner 03-08-2023 00.44_17.jpg": "",
  "CamScanner 03-08-2023 00.44_18.jpg": "",
  "CamScanner 03-08-2023 00.44_20.jpg": "",
  "CamScanner 03-08-2023 00.44_21.jpg": "",
  "CamScanner 03-08-2023 00.44_19.jpg": "",
  "CamScanner 03-08-2023 00.44_2.jpg": "",
  "CamScanner 03-08-2023 00.44_22~2.jpg": "",
  "CamScanner 03-08-2023 00.44_23.jpg": "",
  "CamScanner 03-08-2023 00.44_24.jpg": "",
  "CamScanner 03-08-2023 00.44_25.jpg": "",
  "CamScanner 03-08-2023 00.44_3.jpg": "",
  "CamScanner 03-08-2023 00.44_4.jpg": "",
  "CamScanner 03-08-2023 00.44_5.jpg": "",
  "CamScanner 03-08-2023 00.44_6.jpg": "",
  "CamScanner 03-08-2023 00.44_7.jpg": "",
  "CamScanner 03-08-2023 00.44_8.jpg": "",
  "CamScanner 03-08-2023 00.44_9.jpg": "",
  "CamScanner 03-08-2023 00.44_15.jpg": "",
  "CamScanner 05-12-2021 08.55_10.jpg": "",
  "CamScanner 05-12-2021 08.55_11.jpg": "",
  "CamScanner 05-12-2021 08.55_12.jpg": "",
  "CamScanner 05-12-2021 08.55_13.jpg": "",
  "CamScanner 05-12-2021 08.55_14.jpg": "",
  "CamScanner 05-12-2021 08.55_15.jpg": "",
  "CamScanner 05-12-2021 08.55_16.jpg": "",
  "CamScanner 05-12-2021 08.55_17.jpg": "",
  "CamScanner 05-12-2021 08.55_2.jpg": "",
  "CamScanner 05-12-2021 08.55_4.jpg": "",
  "CamScanner 05-12-2021 08.55_5.jpg": "",
  "CamScanner 05-12-2021 08.55_6.jpg": "",
  "CamScanner 05-12-2021 08.55_7.jpg": "",
  "CamScanner 05-12-2021 08.55_8.jpg": "",
  "CamScanner 05-12-2021 08.55_9.jpg": "",
  "New Doc 2019-11-01 17.39.37_2.jpg": "",
  "New Doc 2019-11-01 17.39.37_4.jpg": "",
  "New Doc 2019-11-09 15.01.16_2.jpg": "",
  "New Doc 2019-11-09 15.01.16_3.jpg": "",
  "New Doc 2019-11-09 15.01.16_4.jpg": "",
  "New Doc 2019-11-09 15.01.16_5.jpg": "",
  "New Doc 2019-11-16 19.29.01_1.jpg": "",
  "New Doc 2019-11-16 19.29.01_2.jpg": "",
  "New Doc 2019-11-16 19.29.01_3.jpg": "",
  "New Doc 2019-12-01 10.57.36_2.jpg": ""
};

var paintings = document.getElementById("blogposts");
for (let element in paintingsInOrder) {
  path = "../blog/-/"+element;
  var imgLink = document.createElement("a");
  imgLink.href=path;
  var img = document.createElement('img');
  img.classList.add("blogpost");
  img.src=path;
  img.alt=element;
  imgLink.appendChild(img);
  // Add description only if there is one
  if (paintingsInOrder[element]) {
    var description = document.createElement('h3');
    description.innerText=paintingsInOrder[element];  
    paintings.appendChild(description);
  }
  paintings.appendChild(imgLink);
}