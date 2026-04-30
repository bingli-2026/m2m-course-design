#set page(
  paper: "a4",
  margin: (x: 2cm, y: 1.8cm),
)
>
#set text(lang: "zh", size: 10.5pt)
#set par(justify: true, leading: 0.75em)

#let diagram-box(title, body) = block(
  width: 100%,
  inset: 8pt,
  stroke: 0.8pt,
  radius: 4pt,
)[
  #set align(center)
  *#title*\
  #v(0.2em)
  #body
]

#align(center)[
  #text(size: 18pt, weight: "bold")[课程设计开题报告]
  #v(0.6em)
  #text(size: 14pt, weight: "bold")[基于 ESP-NOW 与 MQTT 的微型智能产线监测与调度系统设计]
]

#v(1em)

#table(
  columns: (1fr, 2fr, 1fr, 2fr),
  inset: 6pt,
  stroke: 0.6pt,
  align: left + horizon,
  [课设名称], [基于 ESP-NOW 与 MQTT 的微型智能产线监测与调度系统], [班级组别], [G2 Group 8],
  [学生姓名], [冶秉礼、杨炫志、杨喆], 
  [ ], [ ], 
) 

= 一、选题背景与研究目标
本课题面向微型智能产线场景，目标是实现工位状态监测、产量统计、故障告警和远程控制。系统使用三个 ESP32 分别模拟工位终端、产线网关和平台节点，其中终端与网关之间采用 ESP-NOW 通信，网关与平台之间采用 MQTT 通信，并在上位机侧增加单页大屏用于展示运行状态。通过该系统，可以较清楚地体现 M2M 中终端接入、网关转发、平台管理和界面展示的完整流程。

= 二、总体方案
系统由工位终端、产线网关、平台节点、MQTT Broker 和单页大屏组成。工位终端负责采集运行状态、产量、温度和故障码；产线网关负责接收终端数据并转发到平台；平台节点负责设备管理、资源管理和控制命令下发；大屏负责展示设备状态、事件信息和趋势数据。整体结构简单清楚，便于实现和演示。

#figure(
  grid(
    columns: (1.2fr, auto, 1.2fr, auto, 1.2fr),
    column-gutter: 6pt,
    row-gutter: 6pt,
    diagram-box([工位终端], [ESP-NOW 上报\产量统计\故障检测]),
    align(center)[#text(weight: "bold")[→]],
    diagram-box([产线网关], [ESP-NOW 接收\MQTT 转发\短时缓存]),
    align(center)[#text(weight: "bold")[→]],
    diagram-box([平台节点], [设备管理\资源管理\命令下发]),
    [],
    [],
    align(center)[#text(weight: "bold")[↓]],
    [],
    align(center)[#text(weight: "bold")[↓]],
    [],
    [],
    diagram-box([MQTT Broker], [主题分发\消息中转]),
    align(center)[#text(weight: "bold")[→]],
    diagram-box([单页大屏], [状态总览\事件流\趋势展示]),
  ),
  caption: [微型智能产线系统总体架构示意图],
)

= 三、关键功能设计
系统重点实现以下功能：

- 设备注册与心跳保活。
- 工位状态、产量、温度和故障码上报。
- 平台侧设备管理和资源管理。
- 平台下发启动、暂停、复位命令。
- 单页大屏实时展示设备状态和告警信息。

工作流程为：终端通过 ESP-NOW 向网关发送注册信息和业务数据，网关再通过 MQTT 转发给平台；平台根据收到的数据更新设备状态与资源信息，并在需要时通过网关向终端下发控制命令；最终结果同步显示在大屏上。

= 四、实现基础与预期成果
硬件方面，系统使用三块 ESP32 开发板，分别承担工位终端、产线网关和平台节点角色。软件方面，终端与网关之间使用 ESP-NOW，网关与平台之间使用 MQTT，上位机部署 Broker 和单页大屏。预期成果包括一套可运行的微型智能产线监测与调度系统、一页实时展示系统状态的大屏界面，以及完整的课程设计报告。
