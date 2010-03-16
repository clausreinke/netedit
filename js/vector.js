
function Pos(x,y) {
  this.x = x;
  this.y = y;
}
Pos.prototype.toString = function() {
  return 'Pos('+this.x+','+this.y+')';
}
Pos.prototype.vectorTo = function(pos) {
  return new Vector(pos.x-this.x,pos.y-this.y);
}
Pos.prototype.add = function(vec) {
  return new Pos(vec.x+this.x,vec.y+this.y);
}

function Vector(x,y) {
  this.x = x;
  this.y = y;
}
Vector.prototype.toString = function() {
  return 'Vector('+this.x+','+this.y+')';
}
Vector.prototype.length = function() {
  return Math.sqrt(this.x*this.x+this.y*this.y);
}
Vector.prototype.scale = function(s) {
  return new Vector(s*this.x,s*this.y);
}
Vector.prototype.add = function(vec) {
  return new Vector(vec.x+this.x,vec.y+this.y);
}

