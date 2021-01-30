import dotenv = require("dotenv");
dotenv.config();

import { doQuery, closePool } from "@fernap3/sql";
import { parseStringPromise } from "xml2js";
import { parseBooleans, parseNumbers } from "xml2js/lib/processors";

// The XML parser will turn single elemnt arrays into just the
// one element. This is a list of properties that should always
// be arrays, even if they only have one element.
const maintainArraysFor = [
	"entity",
	"cell",
	"row",
	"column",
	"sort",
	"filter",
];

async function run()
{
	const functionNames = (require("./function-names.json") as string[]);
	const functionUsage = {} as { [reportName: string]: Set<string> };
	
	const records = await doQuery<ContentRecord>(`
		SELECT content_id, name, created_date, modified_date, text_content
		FROM sm_access.content
		WHERE content_type = ? AND report_type = ?
	`, [ContentType.Report, ReportType.AdvancedReport]);

	for (const record of records)
	{
		const { report } = await parseStringPromise(record.text_content, {
			explicitArray: false,
			// valueProcessors: [/*parseNumbers,*/ /*parseBooleans,*/ forceArraysForSingleElementCollections],
			ignoreAttrs: true,
		}) as { report: Report };

		for (const reportProp of maintainArraysFor)
		{
			const r = <any>report;
			if (r[reportProp] && r[reportProp].length == null)
				r[reportProp] = [r[reportProp]];
		}

		functionUsage[report.main.report_name] = new Set<string>();

		for (const cell of report.cell ?? [])
		{
			const lowercaseCellText = cell.cell_text?.toLowerCase();

			if (!lowercaseCellText)
				continue;
			
			for (const funcName of functionNames)
			{
				const lowercaseFuncName = funcName.toLowerCase();
				if (lowercaseCellText.includes(`${lowercaseFuncName}(`))
					functionUsage[report.main.report_name].add(funcName);
			}
		}
	}

	console.log("report_name function location");
	for (const reportName in functionUsage)
	{
		for (const funcName of functionUsage[reportName])
		{
			console.log(`${CSVEscape(reportName)},${CSVEscape(funcName)},cell_text`);
		}
	}
}

function CSVEscape(text: string): string
{
	return text.includes(",") ? `"${text.replace(`"`, `""`)}"` : text;
}

(async () => {
	try
	{
		await run();
	}
	finally
	{
		closePool();
	}
})();


interface ContentRecord
{
	content_id: string;
	name: string;
	created_date: string;
	modified_date: string;
	text_content: string;
}

const enum ContentType { Report = 0 };
const enum ReportType { AdvancedReport = 0 };


interface ReportMain
{
	id: string;
	report_name: string,
	folder_name: string,
	folder_id: string,
	version: number,
	type: string,
	sql_stmt: string,
	show_execute_form: boolean,
	filter_execution_window: string,
	fit_page_width: boolean,
	suppress_formatting: boolean,
	report_tree_shortcut: number,
	output_mode: number,
	prevent_output: unknown,
	page_size: string,
	page_orientation: string,
	include_setup_info: string,
	description: string,
	filter_description: string,
	show_grid: boolean,
	pdf_template: string,
	embedded_pdf_template: string,
	simulate_pdf: boolean,
	no_data_render_type: string,
	show_interactive_sorts: boolean,
	allow_column_hide: boolean,
	groups_on_separate_worksheets: boolean,
	enable_cartesian_processing: string,
	visualization_report: boolean,
	use_cache_execution: boolean,
	excel_freeze_rows: number,
	excel_freeze_columns: number,
	excel_show_gridlines: boolean,
	suppressfiltersinterface: boolean,
	suppresssortsinterface: boolean,
	row_range_limit: number,
}

interface ReportEntity
{
	entity_name: string;
	group_by_flag: boolean;
	category: string;
}

interface ReportCell
{
	id: number;
	widget_id: number;
	cell_text: string;
	cell_type: string;
	cell_row: number;
	cell_col: number;
	cell_colspan?: number;
	cell_rowspan?: number;
	wrap_text_flag: boolean;
	font_name: string;
	font_size: number;
}

interface ReportRow
{
	group_type: string;
	group_field: string;
	row_height: number;
	repeat_flag: boolean;
	collapse_header_flag: boolean;
}

interface ReportColumn
{
	column_width: number;
}

interface ReportJoin
{
	affinity: string,
	entity_from_name: string,
	entity_to_name: string,
	entity_from_id: string,
	entity_to_id: string,
	join_type: string,
	relation_type: "1M" | "11",
	weight: number;
	key: {
		col_from_name: string,
		col_to_name: string,
	},
	clause: {
		left_side: string,
		left_side_type: string,
		comparison: string,
		right_side: string,
		right_side_type: string,
		conjunction: string,
		level: number,
	}
}

interface ReportSort
{
	sort_name: string;
	sort_title: string;
	order_num: 0;
	ascending_flag: boolean;
}

interface ReportFilter
{
	filter_name: string;
	order_num: number;
	operator: string;
	prompt_flag: boolean;
	and_flag: boolean;
	group_with_next_flag: boolean;
	filter_ref_id: number;
	filter_title: string;
	values: { value: string }[],
}

interface ReportTopN
{
	action: string;
	use_topn_item: boolean;
	num_items: number;
	cellId: number;
	direction: string;
}

interface ReportWidget
{
	id: number;
	height: number;
	width: number;
	fit_to_cell: boolean;
	built_in_type: string;
	name: string;
	data_cell_ids: string;
	chart?: any;
}

interface Report
{
	main: ReportMain;
	entity: ReportEntity[];
	cell?: ReportCell[];
	row: ReportRow[];
	column: ReportColumn[];
	join: ReportJoin;
	sort: ReportSort[];
	filter: ReportFilter[];
	topn: ReportTopN;
	widget: ReportWidget;
	dynamicfilters: any;
}



