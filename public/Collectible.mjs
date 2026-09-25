class Collectible {
  constructor({ x = 0, y = 0, value = 1, id }) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.id = id;
  }
}

/*
  Note: Attempt to export this for use
  in server.js
*/
try {
  module.exports = Collectible;
} catch(e) {}

export default Collectible;
