const paintingsInOrder = {
  "IMG_20240422_175529_875.png": "Figure",
  "IMG_20240408_165850_607.png": "Figure",
  "IMG_20240408_165850_641.png": "Figure",
  "IMG_20240408_164102_836.png": "Figure",
  "IMG_20240325_072057_320-EDIT.jpg": "A subway scene",
  "BadAtChess.jpg": "Bad at chess",
  "file-kKPq8MyTW33xp5wGje2qzIEl.jpg": "An interesting figure",
  "20230930_232601.jpg": "Charon on the river styx",
  "IMG_20231008_154039_624.jpg": "Archangel waiting in cave",
  "20231114_204153.jpg": "He lives amongst the people",
  "file-SP3jmI3tojDSOwGdcLoyboJN.jpg": "Nature is beautiful",
  "20231203_230336-EDIT(1).jpg": "Saint marzano",
  "071477A9-92EA-4B0D-94C6-13516E581B19.jpg": "Figure",
  "IMG_0094.png": "Figure",
  "IMG_20240226_223909_466.png": "Figure",
  "IMG_0096.png": "Figure - charcoal on paper",
  "CamScanner 07-25-2021 14.51_2.jpg": "All the opps die every summer",
  "IMG_20230913_235900_919.jpg": "Figure",
  "IMG_20230913_235900_937.jpg": "Figure",
  "20231006_080704.jpg": "Figure",
  "IMG_20210625_110136_745.jpg": "figure",
  "IMG_20210616_104906_048.jpg": "figure",
  "IMG_20210609_105420_205.jpg": "figure",
  "CamScanner 06-01-2021 22.35_2.jpg": "figure",
  // "IMG_20240226_224742_240.jpg": "",
  "PSX_20220116_201947.jpg": "Nightmare",
  "20231006_080332.jpg": "brooklyn bridge park",
  "CamScanner 05-06-2024 23.18_4 (1).jpg": "figure drawing",
  "IMG_20230603_124706_633.jpg": "figure drawing",
  "PSX_20221105_143540.jpg": "ferns with bust of mao zedong",
  // "received_10215469036747585.jpg": "self-portrait in acrylic",
  // "20161031_081930.jpg",
  // "20161211_164358.jpg":"self-portrait in oil",
  // "IMG_20190725_205818_809.jpg":"self-portrait in oil",
  // "20180526_105412.jpg":"self-portrait in richmond",
  "IMG_20180403_211743_814.jpg":"bananas",
  "IMG_20181013_152232_310.jpg":"laying in a dream",
  "IMG_20181101_121648_941.jpg":"me sitting on a couch with easel",
  "IMG_20190703_001616_015.jpg":"navigating the world of dreams",
  "IMG_20190716_074334_279.jpg":"sidewalk poop of the goose",
  "IMG_20191111_034703_152.jpg":"cow minding its business",
  "IMG_20200328_110527_975.jpg":"anotha one",
  "IMG_20200409_163824_231.jpg":"early worm gets the bird",
  "IMG_20200424_083904_030.jpg":"we each see nature through different eyes",
  "IMG_20200906_164258_023.jpg":"don't cry blue sky",
  // "IMG_20201006_114314_136.jpg":"I don't like this one that much",
  "IMG_20201026_122134_504.jpg":"a strange invention",
  "IMG_20201122_162742_417.jpg":"monkey minding its business",
  "CamScanner 11-22-2020 22.38_1.jpg":"study of a gofundme campaign",
  "IMG_20201201_143123_797.jpg":"I like this one",
  "IMG_20201214_115726_587.jpg":"man tortured by Santa's elves",
  "IMG_20201231_144606_532.jpg":"burn umber",
  "IMG_20210105_192944_337.jpg":"view from my window (arlington)",
  "IMG_20210114_114200_455.jpg":"man on the verge of caring",
  "IMG_20210417_175028_411.jpg":"extinction button",
  "IMG_20210424_130913_187.jpg":"$MD by A$AP Bocky",
  "IMG_20210426_111243_392.jpg":"a Door",
  "IMG_20210429_105801_166.jpg":"AT.BONG.BLAST.A₿AP",
  "modded3.bmp":"digitally edited",
  // "received_10215469036707584.jpg":"self-portrait in acrylic",
  // "sketch-1567116779342.png":"digital parfum"
};

var paintings = document.getElementById("paintings");

for (let element in paintingsInOrder) {
  const path = "../paintings/-/" + element;

  // Create the painting container
  var paintingContainer = document.createElement("div");
  paintingContainer.classList.add("painting-container");

  // Create the image link
  var imgLink = document.createElement("a");
  imgLink.href = path;

  // Create the image element
  var img = document.createElement("img");
  img.classList.add("art");
  img.src = path;
  img.alt = element;

  // Append the image to the link
  imgLink.appendChild(img);

  // Create the description box
  var descriptionBox = document.createElement("div");
  descriptionBox.classList.add("painting-description");
  descriptionBox.innerText = paintingsInOrder[element];

  // Append the link and description to the container
  paintingContainer.appendChild(imgLink);
  paintingContainer.appendChild(descriptionBox);

  // Append the container to the paintings grid
  paintings.appendChild(paintingContainer);
}
