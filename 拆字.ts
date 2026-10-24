/**
 * 在指定方案下拆分目标字，输出每个字的部件拆法与编码。
 *
 * 供 GitHub Actions 云端运行（也可本地 `bun run 拆字 <方案名> <字...>`）。
 *
 * 用法:
 *   bun run 拆字 <方案名> [字...]
 *
 * 例:
 *   bun run 拆字 easy 㡀 敝 弊 蔽 憋 毙 瞥 撇
 */
import {
  获取字库,
  获取字形分析结果,
  获取拼音分析结果,
  获取组装结果,
  获取原始词典,
  读取配置,
  获取拼音分析与元素映射,
  合并拼写运算,
  获取决策与决策空间,
  决策图,
  计算全部合法元素与元素映射,
  获取自定义分析与元素映射,
  合并分类器,
} from "./packages/hanzi-chai/src/index.js";
import { 获取数据 } from "./packages/hanzi-chai/spec/index.js";
import { readdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const { 原始字库 } = 获取数据();
const 词典 = 原始字库.校验词典(获取原始词典(undefined));
const 方案目录 = join(import.meta.dir, "examples");

function 加载方案(名字: string) {
  for (const 路径 of [
    join(方案目录, `${名字}.yaml`),
    join(方案目录, 名字),
  ]) {
    if (existsSync(路径)) return 读取配置(路径);
  }
  return undefined;
}

/** 把分析条目里的部件序列转成可读字符串 */
function 提取部件(项: any): string {
  const 序列 = 项?.元素序列 ?? 项?.部件序列 ?? 项?.部件 ?? null;
  if (!序列) return "-";
  const 列表 = Array.isArray(序列)
    ? 序列
    : (序列 instanceof Map ? [...序列.values()] : [序列]);
  return 列表
    .map((p: any) => {
      if (p == null) return "?";
      if (typeof p === "string") return p;
      return p.名称 ?? p.字 ?? p.获取名称?.() ?? JSON.stringify(p);
    })
    .join(" ");
}

function 拆方案(方案: any, 目标字: string[]) {
  const 字库 = 获取字库(方案);
  if (!字库.ok) throw 字库.error;

  const 分类器 = 合并分类器((方案 as any).analysis?.classifier);
  const { 拼音元素映射 } = 获取拼音分析与元素映射(方案, 词典);
  const { 自定义元素映射 } = 获取自定义分析与元素映射({}, 原始字库);
  const 字符列表 = [...(字库.value as any)].map(({ 字符 }: any) => 字符);
  const { 名称映射 } = 计算全部合法元素与元素映射(
    字符列表,
    分类器,
    拼音元素映射,
    自定义元素映射,
  );

  const 字形分析 = 获取字形分析结果(方案, 字库.value, 词典, 名称映射, 原始字库);
  if (!字形分析.ok) throw 字形分析.error;
  const 分析结果 = (字形分析.value as any).分析结果 as Map<string, any[]>;

  const { 决策, 决策空间 } = 获取决策与决策空间(
    方案,
    字库.value,
    词典,
    原始字库,
  );
  const 线性化决策 = new 决策图(决策).线性化();
  if (!线性化决策.ok) throw 线性化决策.error;

  const 拼音分析 = 获取拼音分析结果(
    (获取拼音分析与元素映射(方案, 词典) as any).拼音分析映射,
    词典,
  );
  const 如组装结果 = 获取组装结果(
    方案,
    决策,
    决策空间,
    线性化决策.value,
    拼音分析,
    字形分析.value,
  );
  if (!如组装结果.ok) throw 如组装结果.error;
  const 组装结果 = 如组装结果.value as any;

  // 从组装结果取编码：条目形如 { 词: string[], 元素序列, 频率 }
  const 编码表 = new Map<string, string>();
  for (const 条目 of Object.values(组装结果)) {
    const 项 = 条目 as any;
    const 词 = Array.isArray(项?.词) ? 项.词.join("") : 项?.词;
    if (!词) continue;
    编码表.set(词, 提取部件(项));
  }

  const 结果: Record<string, any> = {};
  const 待查 = 目标字.length > 0 ? 目标字 : [...分析结果.keys()];
  for (const 字 of 待查) {
    const 候选 = 分析结果.get(字);
    if (!候选 || 候选.length === 0) {
      结果[字] = { 可拆: false, 说明: "字库中无此字或无法拆分", 候选: [] };
      continue;
    }
    结果[字] = {
      可拆: true,
      候选数: 候选.length,
      拆法: 候选.map((c: any) => 提取部件(c)),
      编码: 编码表.get(字) ?? null,
    };
  }

  return { 结果, 字库数量: 字符列表.length, 分析字数: 分析结果.size };
}

function main() {
  const 参数 = process.argv.slice(2);
  if (参数.length === 0) {
    console.error("用法: bun run 拆字 <方案名> [字...]");
    process.exit(1);
  }
  const 方案名 = 参数[0];
  const 目标字 = 参数.slice(1).filter(Boolean);

  const 方案 = 加载方案(方案名);
  if (!方案) {
    console.error(`找不到方案: ${方案名}`);
    console.error(
      `可用方案: ${readdirSync(方案目录).filter((f) => f.endsWith(".yaml")).join(", ")}`,
    );
    process.exit(1);
  }

  const 方案中文名 = (方案 as any).info?.name ?? 方案名;
  console.log(`方案: ${方案中文名} (${方案名}.yaml)`);
  const { 结果, 字库数量, 分析字数 } = 拆方案(方案, 目标字);
  console.log(`字库字数: ${字库数量}  可分析字数: ${分析字数}`);
  console.log("---");

  for (const [字, 信息] of Object.entries(结果)) {
    if (!信息.可拆) {
      console.log(`${字}\t❌ ${信息.说明}`);
    } else {
      console.log(`${字}\t✅ ${信息.拆法.join("  |  ")}\t${信息.编码 ?? ""}`);
    }
  }

  const 输出 = {
    方案: 方案名,
    方案名: 方案中文名,
    字库数量,
    分析字数,
    结果,
  };
  console.log("---JSON---");
  console.log(JSON.stringify(输出, null, 2));
  writeFileSync("拆字结果.json", JSON.stringify(输出, null, 2), "utf-8");
  console.error("已写入 拆字结果.json");
}

main();
