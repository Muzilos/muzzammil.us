const paintingsInOrder = [
  "received_10215469036747585.jpg",
  "20161031_081930.jpg",
  "20161211_164358.jpg",
  "20180526_105412.jpg",
  "IMG_20180403_211743_814.jpg",
  "IMG_20181013_152232_310.jpg",
  "IMG_20181101_121648_941.jpg",
  "IMG_20190703_001616_015.jpg",
  "IMG_20190716_074334_279.jpg",
  "IMG_20190725_205818_809.jpg",
  "IMG_20191111_034703_152.jpg",
  "IMG_20200328_110527_975.jpg",
  "IMG_20200409_163824_231.jpg",
  "IMG_20200424_083904_030.jpg",
  "IMG_20200906_164258_023.jpg",
  "IMG_20201006_114314_136.jpg",
  "IMG_20201026_122134_504.jpg",
  "IMG_20201122_162742_417.jpg",
  "IMG_20201123_112859_743.jpg",
  "IMG_20201201_143123_797.jpg",
  "IMG_20201214_115726_587.jpg",
  "IMG_20201231_144606_532.jpg",
  "IMG_20210105_192944_337.jpg",
  "IMG_20210114_114200_455.jpg",
  "IMG_20210417_175028_411.jpg",
  "IMG_20210424_130913_187.jpg",
  "IMG_20210426_111243_392.jpg",
  "IMG_20210429_105801_166.jpg",
  "modded3.bmp",
  "received_10215469036707584.jpg",
  "sketch-1567116779342.png"
];

var paintings = document.getElementById("paintings");
for (const element of paintingsInOrder) {
  path = "../static/paintings/"+element
  var imgLink = document.createElement("a");
  imgLink.href=path;
  var img = document.createElement('img');
  img.classList.add("art");
  img.src=path;
  img.alt=element;
  imgLink.appendChild(img);  
  paintings.appendChild(imgLink);
}