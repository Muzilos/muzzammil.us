const paintingsInOrder = {
  "received_10215469036747585.jpg": "self-portrait in acrylic",
  // "20161031_081930.jpg",
  "20161211_164358.jpg":"self-portrait in oil",
  // "IMG_20190725_205818_809.jpg":"self-portrait in oil",
  "20180526_105412.jpg":"self-portrait in richmond",
  "IMG_20180403_211743_814.jpg":"bananas",
  "IMG_20181013_152232_310.jpg":"lady laying in a dream",
  "IMG_20181101_121648_941.jpg":"me sitting on a couch with easel",
  "IMG_20190703_001616_015.jpg":"navigating the world of dreams",
  "IMG_20190716_074334_279.jpg":"sidewalk poop of the goose",
  "IMG_20191111_034703_152.jpg":"cow minding its business",
  "IMG_20200328_110527_975.jpg":"anotha one",
  "IMG_20200409_163824_231.jpg":"early worm gets the bird",
  "IMG_20200424_083904_030.jpg":"we each see nature through different eyes",
  "IMG_20200906_164258_023.jpg":"don't cry blue sky",
  "IMG_20201006_114314_136.jpg":"I don't like this one that much",
  "IMG_20201026_122134_504.jpg":"a strange invention",
  "IMG_20201122_162742_417.jpg":"monkey minding its business",
  "IMG_20201123_112859_743.jpg":"study of a gofundme campaign",
  "IMG_20201201_143123_797.jpg":"I like this one",
  "IMG_20201214_115726_587.jpg":"man tortured by Santa's elves",
  "IMG_20201231_144606_532.jpg":"burn umber (I burned this one)",
  "IMG_20210105_192944_337.jpg":"view from my window (arlington)",
  "IMG_20210114_114200_455.jpg":"man on the verge of caring",
  "IMG_20210417_175028_411.jpg":"extinction button",
  "IMG_20210424_130913_187.jpg":"$MD by A$AP Bocky",
  "IMG_20210426_111243_392.jpg":"a Door to which I found no key, Lament!",
  "IMG_20210429_105801_166.jpg":"AT.BONG.BLAST.A₿AP",
  "modded3.bmp":"programatically modded some colors on this",
  "received_10215469036707584.jpg":"self-portrait in acrylic",
  "sketch-1567116779342.png":"digital parfum"
};

var paintings = document.getElementById("paintings");
for (let element in paintingsInOrder) {
  path = "../static/paintings/"+element;
  var imgLink = document.createElement("a");
  imgLink.href=path;
  var img = document.createElement('img');
  img.classList.add("art");
  img.src=path;
  img.alt=element;
  var description = document.createElement('h3');
  description.innerText=paintingsInOrder[element];
  imgLink.appendChild(img);  
  paintings.appendChild(description);
  paintings.appendChild(imgLink);
}