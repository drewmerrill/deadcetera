(async () => {
  var titles = [
    "Deal",
    "Ripple",
    "US Blues",
    "Deep Elem Blues",
    "Samson and Delilah",
    "Me and My Uncle",
    "Eyes of the World",
    "That's What Love Will Make You Do"
  ];
  var out = [];
  for (var i = 0; i < titles.length; i++) {
    var t = titles[i];
    var id = GLStore.getSongIdByTitle(t);
    var cd = await loadBandDataFromDrive(t, "chart");
    var head = (cd && cd.text)
      ? cd.text.split("\n").slice(0, 2).join(" / ")
      : "(none)";
    out.push(t + " | " + id + " | " + head);
  }
  window.__r = out.join("\n");
  console.log(window.__r);
  alert(window.__r);
})();
