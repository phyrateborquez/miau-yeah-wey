class Player {
  constructor({ x = 0, y = 0, score = 0, id }) {
    this.x = x;
    this.y = y;
    this.score = score;
    this.id = id;
  }

  movePlayer(dir, speed) {
    switch (dir) {
      case 'up':
        this.y -= speed;
        break;
      case 'down':
        this.y += speed;
        break;
      case 'left':
        this.x -= speed;
        break;
      case 'right':
        this.x += speed;
        break;
      default:
        break;
    }
  }

  collision(item) {
    if (!item) return false;
    const playerSize = 30;
    const itemSize = 30;
    return (
      this.x < item.x + itemSize &&
      this.x + playerSize > item.x &&
      this.y < item.y + itemSize &&
      this.y + playerSize > item.y
    );
  }

  calculateRank(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return 'Rank: 1/1';
    }
    const currentRanking = arr.filter(player => player.score > this.score).length + 1;
    return `Rank: ${currentRanking}/${arr.length}`;
  }
}

try {
  module.exports = Player;
} catch (e) {}

export default Player;
