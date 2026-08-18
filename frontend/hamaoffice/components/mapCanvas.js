import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';

export default function MapCanvas({
  width,
  height,
  obstacles,
  myPos,
  myName,
  others,
  onMyDrag,
  onMyDragEnd,
}) {
  return (
    <Stage width={width} height={height}>
      <Layer>
        <Rect x={0} y={0} width={width} height={height} fill="#eef2f7" />
        {obstacles.map((o, i) => (
          <Rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} fill="#94a3b8" />
        ))}
        {others.map((u) => (
          <Group key={u.id} x={u.x} y={u.y}>
            <Circle radius={16} fill="#38bdf8" stroke="#0284c7" strokeWidth={2} />
            <Text text={u.name} y={22} offsetX={40} width={80} align="center" fontSize={12} />
          </Group>
        ))}
        <Group
          x={myPos.x}
          y={myPos.y}
          draggable
          dragBoundFunc={(pos) => onMyDrag(pos.x, pos.y)}
          onDragEnd={onMyDragEnd}
        >
          <Circle radius={16} fill="#4ade80" stroke="#16a34a" strokeWidth={2} />
          <Text text={myName} y={22} offsetX={40} width={80} align="center" fontSize={12} />
        </Group>
      </Layer>
    </Stage>
  );
}
