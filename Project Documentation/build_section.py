import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_table_borders_none(table):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:insideH w:val="none"/>'
        f'<w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def set_table_borders_grid(table):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>'
        f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def set_cell_shading(cell, color_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=60, bottom=60, left=100, right=100):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def format_table_row(row, is_header=False):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
    if is_header:
        trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

def build_report_preliminaries():
    doc = docx.Document()

    # Section Setup: A4, 1-inch margins
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)

    # Dynamic lowerRoman page numbers (i, ii, iii, iv, v)
    sectPr = section._sectPr
    pgNumType = parse_xml(f'<w:pgNumType {nsdecls("w")} w:fmt="lowerRoman" w:start="1"/>')
    sectPr.append(pgNumType)

    footer = section.footer
    f_p = footer.paragraphs[0]
    f_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fldSimple = parse_xml(f'<w:fldSimple {nsdecls("w")} w:instr="PAGE"/>')
    f_p._p.append(fldSimple)
    for r in f_p.runs:
        r.font.name = 'Times New Roman'
        r.font.size = Pt(12)

    # Base style
    normal = doc.styles['Normal']
    normal.font.name = 'Times New Roman'
    normal.font.size = Pt(12)
    normal.font.color.rgb = RGBColor(0, 0, 0)

    students = [
        ('Aman Adil', '300102223013', 'CD8369'),
        ('Amit Sahu', '300102223015', 'CD8347'),
        ('Anupam Sharma', '300102223023', 'CD8391'),
    ]

    # =========================================================================
    # PAGE 1: DECLARATION BY THE CANDIDATE(s) (Page i)
    # =========================================================================
    p_dec_title = doc.add_paragraph()
    p_dec_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dec_title.paragraph_format.space_before = Pt(10)
    p_dec_title.paragraph_format.space_after = Pt(26)
    r = p_dec_title.add_run('DECLARATION BY THE CANDIDATE(s)')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(16)
    r.font.bold = True

    p1 = doc.add_paragraph()
    p1.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p1.paragraph_format.line_spacing = 1.5
    p1.paragraph_format.space_after = Pt(14)
    r = p1.add_run('We, the undersigned, solemnly declare that the report of the project work entitled ')
    r.font.name = 'Times New Roman'
    r = p1.add_run('"AutoDev: An Autonomous Multi-Agent Software Engineering Platform"')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p1.add_run(', is based on our own work carried out during the course of our study under the supervision of ')
    r.font.name = 'Times New Roman'
    r = p1.add_run('Prof. Usha Kiran')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p1.add_run(', Assistant Professor, Department of Computer Science and Engineering, Bhilai Institute of Technology, Durg.')
    r.font.name = 'Times New Roman'

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p2.paragraph_format.line_spacing = 1.5
    p2.paragraph_format.space_after = Pt(14)
    r = p2.add_run('We assert that the statements made and conclusions drawn are an outcome of the project work.')
    r.font.name = 'Times New Roman'

    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p3.paragraph_format.line_spacing = 1.5
    p3.paragraph_format.space_after = Pt(32)
    r = p3.add_run(
        'We further declare that to the best of our knowledge and belief that the report does not contain any part of '
        'any work which has been submitted for the award of any other degree/diploma/certificate in this University/ '
        'any other University of India or any other country.'
    )
    r.font.name = 'Times New Roman'

    t_dec = doc.add_table(rows=1, cols=2)
    t_dec.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_dec.autofit = False
    set_table_borders_none(t_dec)
    t_dec.columns[0].width = Inches(2.6)
    t_dec.columns[1].width = Inches(3.67)

    p_dp = t_dec.rows[0].cells[0].paragraphs[0]
    p_dp.paragraph_format.line_spacing = 1.3
    p_dp.paragraph_format.space_before = Pt(28)
    r = p_dp.add_run('Date: __________________\n\nPlace: Durg (C.G.)')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(12)

    p_sig = t_dec.rows[0].cells[1].paragraphs[0]
    p_sig.paragraph_format.line_spacing = 1.2
    p_sig.paragraph_format.space_after = Pt(0)

    for idx, (name, roll, enr) in enumerate(students):
        r_sig = p_sig.add_run('(Signature of Student)\n')
        r_sig.font.name = 'Times New Roman'
        r_sig.font.size = Pt(12)
        r_sig.font.bold = True

        r_info = p_sig.add_run(f'Name of the Candidate: {name}\nUniversity Roll no.: {roll}\nEnrollment No.: {enr}\n')
        r_info.font.name = 'Times New Roman'
        r_info.font.size = Pt(12)

        if idx < len(students) - 1:
            p_sig.add_run('\n')

    # =========================================================================
    # PAGE 2: APPROVAL CERTIFICATE (Page ii)
    # =========================================================================
    doc.add_page_break()

    p_app_title = doc.add_paragraph()
    p_app_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_app_title.paragraph_format.space_before = Pt(10)
    p_app_title.paragraph_format.space_after = Pt(24)
    r = p_app_title.add_run('APPROVAL CERTIFICATE')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(16)
    r.font.bold = True

    p_app1 = doc.add_paragraph()
    p_app1.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_app1.paragraph_format.line_spacing = 1.5
    p_app1.paragraph_format.space_after = Pt(12)
    r = p_app1.add_run('This is to Certify that the report of the project submitted is an outcome of the project work entitled ')
    r.font.name = 'Times New Roman'
    r = p_app1.add_run('"AutoDev: An Autonomous Multi-Agent Software Engineering Platform"')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p_app1.add_run(
        ', carried out by Aman Adil bearing Roll No. 300102223013, Enrollment No. CD8369; '
        'Amit Sahu bearing Roll No. 300102223015, Enrollment No. CD8347; '
        'Anupam Sharma bearing Roll No. 300102223023, Enrollment No. CD8391.'
    )
    r.font.name = 'Times New Roman'

    p_app2 = doc.add_paragraph()
    p_app2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_app2.paragraph_format.line_spacing = 1.5
    p_app2.paragraph_format.space_after = Pt(12)
    r = p_app2.add_run(
        'Under my guidance and supervision in partial fulfillment of Bachelor of Technology in Computer '
        'Science and Engineering from Bhilai Institute of Technology, Durg, an autonomous institute affiliated to '
        'Chhattisgarh Swami Vivekanand Technical University, Bhilai (C.G).'
    )
    r.font.name = 'Times New Roman'

    p_app3 = doc.add_paragraph()
    p_app3.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_app3.paragraph_format.line_spacing = 1.4
    p_app3.paragraph_format.space_after = Pt(28)
    r = p_app3.add_run('To the best of my knowledge and belief the project:\n')
    r.font.name = 'Times New Roman'
    r = p_app3.add_run(
        'i)   Embodies the work of the candidate himself / herself,\n'
        'ii)  Has duly been completed,\n'
        'iii) Fulfills the requirement of the Ordinance relating to the B. Tech. degree of the university,\n'
        'iv)  Is up to the desired standard for the purpose of which is submitted.'
    )
    r.font.name = 'Times New Roman'

    p_sup = doc.add_paragraph()
    p_sup.paragraph_format.space_before = Pt(14)
    p_sup.paragraph_format.space_after = Pt(28)
    p_sup.paragraph_format.line_spacing = 1.25
    r = p_sup.add_run('(Signature of the Supervisor)\n')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p_sup.add_run('Prof. Usha Kiran\nAssistant Prof. Department\nComputer Science and Engineering,\nBhilai Institute of Technology, Durg')
    r.font.name = 'Times New Roman'

    p_fwd = doc.add_paragraph()
    p_fwd.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_fwd.paragraph_format.line_spacing = 1.3
    p_fwd.paragraph_format.space_after = Pt(28)
    r = p_fwd.add_run('The Project work as mentioned above is hereby being recommended and forwarded for examination and evaluation.')
    r.font.name = 'Times New Roman'

    p_hod = doc.add_paragraph()
    p_hod.paragraph_format.space_before = Pt(8)
    p_hod.paragraph_format.line_spacing = 1.25
    r = p_hod.add_run('Dr. (Mrs) Sunita Soni\n')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p_hod.add_run('Head of the Department\nComputer Science & Engineering\nBhilai Institute of Technology, Durg')
    r.font.name = 'Times New Roman'

    # =========================================================================
    # PAGE 3: CERTIFICATE BY THE EXAMINERS (Page iii)
    # =========================================================================
    doc.add_page_break()

    p_ex_title = doc.add_paragraph()
    p_ex_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_ex_title.paragraph_format.space_before = Pt(10)
    p_ex_title.paragraph_format.space_after = Pt(24)
    r = p_ex_title.add_run('CERTIFICATE BY THE EXAMINERS')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(16)
    r.font.bold = True

    p_ex1 = doc.add_paragraph()
    p_ex1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_ex1.paragraph_format.space_after = Pt(14)
    r = p_ex1.add_run('This is to Certify that the project entitled')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(13)

    p_proj_title = doc.add_paragraph()
    p_proj_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_proj_title.paragraph_format.space_before = Pt(6)
    p_proj_title.paragraph_format.space_after = Pt(18)
    r = p_proj_title.add_run('"AutoDev: An Autonomous Multi-Agent Software Engineering Platform"')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(14)
    r.font.bold = True

    p_sub_by = doc.add_paragraph()
    p_sub_by.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub_by.paragraph_format.space_after = Pt(12)
    r = p_sub_by.add_run('Submitted by')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(12)
    r.font.italic = True

    t_students = doc.add_table(rows=3, cols=2)
    t_students.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders_none(t_students)
    t_students.columns[0].width = Inches(3.0)
    t_students.columns[1].width = Inches(3.0)

    for idx, (name, roll, enr) in enumerate(students):
        cell_left = t_students.rows[idx].cells[0]
        cell_right = t_students.rows[idx].cells[1]

        p_l = cell_left.paragraphs[0]
        p_l.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p_l.paragraph_format.line_spacing = 1.2
        r = p_l.add_run(f'{name}  ')
        r.font.name = 'Times New Roman'
        r.font.bold = True

        p_r = cell_right.paragraphs[0]
        p_r.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_r.paragraph_format.line_spacing = 1.2
        r = p_r.add_run(f'Enrollment No: {enr}\nRoll No: {roll}')
        r.font.name = 'Times New Roman'

    p_ex_body = doc.add_paragraph()
    p_ex_body.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ex_body.paragraph_format.line_spacing = 1.5
    p_ex_body.paragraph_format.space_before = Pt(28)
    p_ex_body.paragraph_format.space_after = Pt(40)
    r = p_ex_body.add_run(
        'Have been examined by the undersigned as a part of the examination for the award of Bachelor of Technology '
        'degree in Computer Science and Engineering from Bhilai Institute of Technology, Durg, an autonomous '
        'institute affiliated to Chhattisgarh Swami Vivekanand Technical University, Bhilai (C.G).'
    )
    r.font.name = 'Times New Roman'

    t_ex = doc.add_table(rows=1, cols=2)
    t_ex.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_ex.autofit = False
    set_table_borders_none(t_ex)
    t_ex.columns[0].width = Inches(3.1)
    t_ex.columns[1].width = Inches(3.17)

    p_int = t_ex.rows[0].cells[0].paragraphs[0]
    p_int.paragraph_format.line_spacing = 1.4
    r = p_int.add_run('(Internal Examiner)\n').bold = True
    r = p_int.add_run('Name: ______________________\nDate: ______________________')

    p_ext = t_ex.rows[0].cells[1].paragraphs[0]
    p_ext.paragraph_format.line_spacing = 1.4
    r = p_ext.add_run('(External Examiner)\n').bold = True
    r = p_ext.add_run('Name: ______________________\nDate: ______________________')

    # =========================================================================
    # PAGE 4: ACKNOWLEDGEMENT (Page iv)
    # =========================================================================
    doc.add_page_break()

    p_ack_title = doc.add_paragraph()
    p_ack_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_ack_title.paragraph_format.space_before = Pt(10)
    p_ack_title.paragraph_format.space_after = Pt(24)
    r = p_ack_title.add_run('ACKNOWLEDGEMENT')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(16)
    r.font.bold = True

    p_ack1 = doc.add_paragraph()
    p_ack1.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ack1.paragraph_format.line_spacing = 1.5
    p_ack1.paragraph_format.space_after = Pt(12)
    r = p_ack1.add_run(
        'We have great pleasure in the submission of this project report entitled '
    )
    r.font.name = 'Times New Roman'
    r = p_ack1.add_run('"AutoDev: An Autonomous Multi-Agent Software Engineering Platform"')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p_ack1.add_run(
        ' in partial fulfillment the degree of Bachelor of Technology. While submitting this project report, '
        'we take this opportunity to thank those directly or indirectly related to project work.'
    )
    r.font.name = 'Times New Roman'

    p_ack2 = doc.add_paragraph()
    p_ack2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ack2.paragraph_format.line_spacing = 1.5
    p_ack2.paragraph_format.space_after = Pt(12)
    r = p_ack2.add_run(
        'We would like to thank our supervisor '
    )
    r.font.name = 'Times New Roman'
    r = p_ack2.add_run('Prof. Usha Kiran')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p_ack2.add_run(
        ' who has provided the opportunity and organizing project for us. Without her active co-operation and guidance, '
        'it would have been become very difficult to complete task in time.'
    )
    r.font.name = 'Times New Roman'

    p_ack3 = doc.add_paragraph()
    p_ack3.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ack3.paragraph_format.line_spacing = 1.5
    p_ack3.paragraph_format.space_after = Pt(12)
    r = p_ack3.add_run(
        'We would like to express sincere thanks and gratitude to '
    )
    r.font.name = 'Times New Roman'
    r = p_ack3.add_run('Dr. Anup Mishra')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p_ack3.add_run(', Principal of the Institution, ')
    r.font.name = 'Times New Roman'
    r = p_ack3.add_run('Dr. (Mrs.) Sunita Soni')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p_ack3.add_run(
        ', Head of the Department Computer Science & Engineering for their encouragement and cordial support.'
    )
    r.font.name = 'Times New Roman'

    p_ack4 = doc.add_paragraph()
    p_ack4.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ack4.paragraph_format.line_spacing = 1.5
    p_ack4.paragraph_format.space_after = Pt(28)
    r = p_ack4.add_run(
        'While Submission of the project, we also like to thank to '
    )
    r.font.name = 'Times New Roman'
    r = p_ack4.add_run('Prof. S. D. Mishra')
    r.font.name = 'Times New Roman'
    r.font.bold = True
    r = p_ack4.add_run(
        ' for his continuous help and guidance throughout the course of project.'
    )
    r.font.name = 'Times New Roman'

    # Student Names block
    p_ack_cand = doc.add_paragraph()
    p_ack_cand.paragraph_format.space_before = Pt(12)
    p_ack_cand.paragraph_format.line_spacing = 1.25
    p_ack_cand.paragraph_format.space_after = Pt(0)

    for idx, (name, roll, enr) in enumerate(students):
        r = p_ack_cand.add_run(f'Name of the Candidate: {name}\n')
        r.font.name = 'Times New Roman'
        r.font.bold = True
        r = p_ack_cand.add_run(f'University Roll no.: {roll}\nEnrollment No.: {enr}\n\n')
        r.font.name = 'Times New Roman'

    # =========================================================================
    # PAGE 5: ABSTRACT (Page v)
    # =========================================================================
    doc.add_page_break()

    p_abs_title = doc.add_paragraph()
    p_abs_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_abs_title.paragraph_format.space_before = Pt(10)
    p_abs_title.paragraph_format.space_after = Pt(24)
    r = p_abs_title.add_run('ABSTRACT')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(16)
    r.font.bold = True

    p_abs1 = doc.add_paragraph()
    p_abs1.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_abs1.paragraph_format.line_spacing = 1.5
    p_abs1.paragraph_format.space_after = Pt(12)
    r = p_abs1.add_run(
        'AutoDev is an autonomous, full-stack Software Development Life Cycle (SDLC) engineering platform engineered '
        'to fundamentally transform how software systems are conceptualized, architected, generated, and verified from '
        'natural language requirements. Recognizing that conventional generative AI workflows suffer from acute context '
        'dilution, stochastic hallucinations, lack of empirical runtime grounding, and severe vulnerability to upstream API '
        'rate-limiting, this project leverages a decoupled multi-agent collaborative network. By replacing fragile, single-prompt '
        'code emissions with disciplined software engineering roles—Master Architect, Component DAG Scheduler, CodeGen Agents, '
        'and Multi-Critic Arbiters—the platform bridges the gap between conversational assistance and autonomous, production-grade '
        'software repository delivery.'
    )
    r.font.name = 'Times New Roman'

    p_abs2 = doc.add_paragraph()
    p_abs2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_abs2.paragraph_format.line_spacing = 1.5
    p_abs2.paragraph_format.space_after = Pt(12)
    r = p_abs2.add_run(
        'Under the hood, the system architecture operates across two specialized operational paradigms: a Single-Pass Autonomous '
        'SDLC for direct modules and a Component-Wise Parallel Pipeline DAG Engine for enterprise-scale multi-tier systems. The Master '
        'Architect decomposes complex requirements into an acyclic dependency graph scheduled concurrently using Kahn’s topological '
        'sort and Tarjan’s Strongly Connected Components (SCC) cycle resolution. Concurrency safety is mathematically guaranteed through '
        'lease-backed stage mutexes, monotonic epoch fencing, and atomic two-phase handovers that eliminate Coffman’s four deadlock conditions. '
        'To ensure high availability against commercial LLM quota exhaustion, a dynamic Multi-Pool Smart API Key Balancer continuously evaluates '
        'real-time token exhaustion, applies exponential cooldown penalties, and performs Chi-Square (χ²) fair load distribution across multi-tier '
        'provider fallback matrices.'
    )
    r.font.name = 'Times New Roman'

    p_abs3 = doc.add_paragraph()
    p_abs3.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_abs3.paragraph_format.line_spacing = 1.5
    p_abs3.paragraph_format.space_after = Pt(14)
    r = p_abs3.add_run(
        'To enforce deterministic code correctness, AutoDev couples rootless Docker container execution with an automated multi-critic '
        'peer-review network (AST validation, linting, semantic logic verification, and security vulnerability auditing). Candidate code is '
        'executed in isolated sandboxes to capture runtime diagnostics and unit test failures, driving autonomous self-healing re-generation loops. '
        'The platform delivers an asynchronous, hardware-accelerated translucent web console built with React 19, TypeScript, and Tailwind CSS, '
        'featuring an embedded Monaco IDE, real-time Server-Sent Events (SSE) telemetry, timeline Gantt charts, live container previews, and '
        'one-click atomic GitHub repository export. Empirical evaluations demonstrate an 88.4% first-cycle compilation rate across polyglot workloads, '
        'a 3.4× speedup in multi-component delivery through parallel DAG scheduling, and zero concurrency deadlocks across extensive validated stages.'
    )
    r.font.name = 'Times New Roman'

    p_kw = doc.add_paragraph()
    p_kw.paragraph_format.space_before = Pt(10)
    p_kw.paragraph_format.line_spacing = 1.3
    r = p_kw.add_run('Keywords: ').bold = True
    r = p_kw.add_run(
        'Autonomous Multi-Agent Systems, Directed Acyclic Graph (DAG), Software Development Life Cycle (SDLC), '
        'Kahn’s Topological Sort, Monotonic Epoch Fencing, Smart API Key Balancer, Docker Sandboxing, LangGraph, Monaco IDE.'
    )
    r.font.name = 'Times New Roman'

    # =========================================================================
    # PAGE 6: TABLE OF CONTENT (Page vi)
    # =========================================================================
    doc.add_page_break()

    p_toc_title = doc.add_paragraph()
    p_toc_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_toc_title.paragraph_format.space_before = Pt(10)
    p_toc_title.paragraph_format.space_after = Pt(20)
    r = p_toc_title.add_run('TABLE OF CONTENT')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(16)
    r.font.bold = True

    toc_entries = [
        ('', 'Declaration by the Candidate(s)', 'i', 0),
        ('', 'Approval Certificate', 'ii', 0),
        ('', 'Certificate by the Examiners', 'iii', 0),
        ('', 'Acknowledgement', 'iv', 0),
        ('', 'Abstract', 'v', 0),
        ('', 'List of Figures', 'viii', 0),
        ('', 'List of Tables', 'x', 0),
        ('CHAPTER: 1', 'INTRODUCTION', '1', 1),
        ('1.1', 'Introduction', '1', 2),
        ('1.2', 'Research Background and Motivation', '1', 2),
        ('1.3', 'Overview of the System', '3', 2),
        ('1.4', 'Organization of Report', '5', 2),
        ('CHAPTER: 2', 'LITERATURE REVIEW', '6', 1),
        ('2.1', 'Evolution of Autonomous Software Engineering & Multi-Agent Frameworks', '6', 2),
        ('2.2', 'Directed Acyclic Graph (DAG) Scheduling & Cycle Detection in Program Synthesis', '8', 2),
        ('2.3', 'Distributed State Synchronization, Mutex Locking & Monotonic Epoch Fencing', '9', 2),
        ('2.4', 'Sandboxed Container Execution & Multi-Critic Automated Peer Review', '10', 2),
        ('2.5', 'Existing Systems & Comparative Limitations', '12', 2),
        ('CHAPTER: 3', 'PROBLEM IDENTIFICATION AND OBJECTIVE', '14', 1),
        ('3.1', 'Statement of the Problem', '14', 2),
        ('3.2', 'Objectives of the Project', '15', 2),
        ('3.3', 'Scope of the Project', '16', 2),
        ('CHAPTER: 4', 'METHODOLOGY', '17', 1),
        ('4.1', 'System Architecture & Multi-Agent Topology', '17', 2),
        ('4.2', 'Component DAG Scheduler & Tarjan’s SCC Cycle Resolution', '19', 2),
        ('4.3', 'Concurrency Control: Lease-Backed Mutexes & Monotonic Epoch Fencing', '21', 2),
        ('4.4', 'Dynamic Multi-Pool Smart API Key Balancer & Chi-Square Fair Distribution', '23', 2),
        ('4.5', 'Universal Rootless Docker Sandbox & Runtime Isolation Engine', '25', 2),
        ('4.6', 'Multi-Critic Peer-Review & Closed-Loop Self-Healing Network', '27', 2),
        ('4.7', 'Database Schema & Write-Ahead Event Telemetry Architecture', '29', 2),
        ('4.8', 'Technology Stack Selection & Justification', '30', 2),
        ('CHAPTER: 5', 'RESULTS AND DISCUSSION', '32', 1),
        ('5.1', 'User Interface Architecture & Operational Workflow', '32', 2),
        ('5.1.1', 'Landing & Workspace Management Hub', '32', 3),
        ('5.1.2', 'Dual Operational Paradigm: Single-Pass SDLC vs. Component DAG Engine', '33', 3),
        ('5.2', 'Interactive Requirements Ingestion & Blueprint Specification', '35', 2),
        ('5.3', 'Component Dependency Graph Visualization & Real-Time Gantt Telemetry', '37', 2),
        ('5.4', 'Embedded Monaco IDE, Multi-File Explorer & SSE Log Streaming', '39', 2),
        ('5.5', 'Isolated Docker Verification Terminal & Runtime Diagnostics', '41', 2),
        ('5.6', 'Multi-Critic Peer-Review & Autonomous Self-Healing Patching Loop', '43', 2),
        ('5.7', 'Repository Synthesis, Unified Packaging & Live Container Preview', '45', 2),
        ('5.8', 'Multi-Pool API Key Health Matrix & One-Click GitHub Export', '47', 2),
        ('5.9', 'Empirical Performance Evaluation & Benchmark Results', '48', 2),
        ('5.9.1', 'First-Cycle Compilation & Execution Success Rates', '48', 3),
        ('5.9.2', 'DAG Concurrency Speedup & Throughput Analysis', '50', 3),
        ('5.9.3', 'Mathematical Verification of Deadlock Freedom', '51', 3),
        ('CHAPTER: 6', 'CONCLUSIONS AND FUTURE SCOPE OF WORK', '52', 1),
        ('6.1', 'Conclusions', '52', 2),
        ('6.2', 'Future Scope of Work', '53', 2),
        ('', 'REFERENCES', '55', 1),
    ]

    t_toc = doc.add_table(rows=len(toc_entries) + 1, cols=3)
    t_toc.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_toc.autofit = False
    set_table_borders_grid(t_toc)

    col_widths_toc = [Inches(1.35), Inches(4.12), Inches(0.80)]
    for row in t_toc.rows:
        for idx, width in enumerate(col_widths_toc):
            row.cells[idx].width = width

    format_table_row(t_toc.rows[0], is_header=True)
    hdr_titles = ['Chapter', 'Title', 'Page No.']
    for idx, title in enumerate(hdr_titles):
        cell = t_toc.rows[0].cells[idx]
        set_cell_shading(cell, 'F2F4F7')
        set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx != 1 else WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(title)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)
        r.font.bold = True

    for row_idx, (col0, col1, col2, level) in enumerate(toc_entries, start=1):
        row = t_toc.rows[row_idx]
        format_table_row(row, is_header=False)
        for c_idx in range(3):
            cell = row.cells[c_idx]
            set_cell_margins(cell, top=50, bottom=50, left=90, right=90)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

        p0 = row.cells[0].paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER if level == 1 else WD_ALIGN_PARAGRAPH.LEFT
        p0.paragraph_format.space_before = Pt(0)
        p0.paragraph_format.space_after = Pt(0)
        p0.paragraph_format.line_spacing = 1.15
        r0 = p0.add_run(col0)
        r0.font.name = 'Times New Roman'
        r0.font.size = Pt(10.5) if level != 1 else Pt(11)
        if level == 1:
            r0.font.bold = True

        p1 = row.cells[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p1.paragraph_format.space_before = Pt(0)
        p1.paragraph_format.space_after = Pt(0)
        p1.paragraph_format.line_spacing = 1.15
        if level == 2:
            p1.paragraph_format.left_indent = Inches(0.15)
        elif level == 3:
            p1.paragraph_format.left_indent = Inches(0.35)
        r1 = p1.add_run(col1)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(10) if level == 3 else (Pt(11) if level == 1 else Pt(10.5))
        if level == 1:
            r1.font.bold = True

        p2 = row.cells[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after = Pt(0)
        p2.paragraph_format.line_spacing = 1.15
        r2 = p2.add_run(col2)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(10.5) if level != 1 else Pt(11)
        if level == 1:
            r2.font.bold = True

    # =========================================================================
    # PAGE 8: LIST OF FIGURES (Page viii)
    # =========================================================================
    doc.add_page_break()

    p_fig_title = doc.add_paragraph()
    p_fig_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_fig_title.paragraph_format.space_before = Pt(10)
    p_fig_title.paragraph_format.space_after = Pt(20)
    r = p_fig_title.add_run('LIST OF FIGURES')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(16)
    r.font.bold = True

    figures_entries = [
        ('4.1', 'High-Level Multi-Agent System Architecture Topology', '18'),
        ('4.2', 'Component Dependency Graph Scheduling & Tarjan SCC Cycle Resolution Flowchart', '20'),
        ('4.3', 'Concurrency Control Lifecycle with Lease-Backed Mutexes and Monotonic Epoch Fencing', '22'),
        ('4.4', 'Dynamic Multi-Pool Smart API Key Balancer State Machine & Cooldown Decay', '24'),
        ('4.5', 'Universal Rootless Docker Sandbox & Ephemeral Container Execution Lifecycle', '26'),
        ('4.6', 'Multi-Critic Peer-Review & Closed-Loop Self-Healing Arbitration Network', '28'),
        ('4.7', 'Database Entity-Relationship & Write-Ahead Event Telemetry Schema', '29'),
        ('5.1', 'AutoDev Landing Interface & Workspace Management Hub', '32'),
        ('5.2', 'User Authentication & Multi-Provider API Configuration Modal', '33'),
        ('5.3', 'Stage 1 — Interactive Requirements Scoping & Clarification Interface', '35'),
        ('5.4', 'Stage 2 — Master Architect System Blueprint & Module Decomposition', '36'),
        ('5.5', 'Stage 3 — Component Pipeline DAG Visualizer & Dynamic Track Allocator', '38'),
        ('5.6', 'Stages 4 & 5 — Embedded Monaco IDE & Multi-File Code Synthesis Terminal', '40'),
        ('5.7', 'Stage 6 — Isolated Docker Sandbox Execution & Runtime Test Terminal', '42'),
        ('5.8', 'Stage 7 — Multi-Critic Peer-Review Consensus & AST Validation Dashboard', '44'),
        ('5.9', 'Stage 8 — Full Repository Assembly & Live Container Application Preview', '45'),
        ('5.10', 'Stage 9 — Chronological Execution Timeline & Component Gantt Telemetry', '46'),
        ('5.11', 'Stage 10 — One-Click Atomic GitHub Export Modal', '47'),
    ]

    t_fig = doc.add_table(rows=len(figures_entries) + 1, cols=3)
    t_fig.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_fig.autofit = False
    set_table_borders_grid(t_fig)

    col_widths_fig = [Inches(1.10), Inches(4.37), Inches(0.80)]
    for row in t_fig.rows:
        for idx, width in enumerate(col_widths_fig):
            row.cells[idx].width = width

    format_table_row(t_fig.rows[0], is_header=True)
    fig_hdr = ['Fig No.', 'Title', 'Page No.']
    for idx, title in enumerate(fig_hdr):
        cell = t_fig.rows[0].cells[idx]
        set_cell_shading(cell, 'F2F4F7')
        set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx != 1 else WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(title)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)
        r.font.bold = True

    for row_idx, (col0, col1, col2) in enumerate(figures_entries, start=1):
        row = t_fig.rows[row_idx]
        format_table_row(row, is_header=False)
        for c_idx in range(3):
            cell = row.cells[c_idx]
            set_cell_margins(cell, top=55, bottom=55, left=90, right=90)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

        p0 = row.cells[0].paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p0.paragraph_format.space_before = Pt(0)
        p0.paragraph_format.space_after = Pt(0)
        p0.paragraph_format.line_spacing = 1.15
        r0 = p0.add_run(col0)
        r0.font.name = 'Times New Roman'
        r0.font.size = Pt(10.5)

        p1 = row.cells[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p1.paragraph_format.space_before = Pt(0)
        p1.paragraph_format.space_after = Pt(0)
        p1.paragraph_format.line_spacing = 1.15
        r1 = p1.add_run(col1)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(10.5)

        p2 = row.cells[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after = Pt(0)
        p2.paragraph_format.line_spacing = 1.15
        r2 = p2.add_run(col2)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(10.5)

    # =========================================================================
    # PAGE 10: LIST OF TABLES (Page x)
    # =========================================================================
    doc.add_page_break()

    p_tbl_title = doc.add_paragraph()
    p_tbl_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tbl_title.paragraph_format.space_before = Pt(10)
    p_tbl_title.paragraph_format.space_after = Pt(20)
    r = p_tbl_title.add_run('LIST OF TABLES')
    r.font.name = 'Times New Roman'
    r.font.size = Pt(16)
    r.font.bold = True

    tables_entries = [
        ('2.1', 'Comparative Feature Analysis of Autonomous Software Engineering Platforms', '12'),
        ('4.1', 'Formal Mutex Acquisition and Monotonic Epoch Fencing Protocols', '22'),
        ('4.2', 'Chi-Square (χ²) Goodness-of-Fit Distribution Across API Provider Pools', '25'),
        ('4.3', 'Technology Stack Selection Justification and Architectural Trade-off Matrix', '30'),
        ('5.1', 'Multi-Provider API Key Health, Degradation Penalties, and Cooldown Matrix', '48'),
        ('5.2', 'Empirical Benchmark of Single-Pass SDLC vs. Component DAG Parallel Pipeline', '49'),
        ('5.3', 'Closed-Loop Self-Healing Success Rate across Multi-Critic Repair Iterations', '50'),
    ]

    t_tbl = doc.add_table(rows=len(tables_entries) + 1, cols=3)
    t_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_tbl.autofit = False
    set_table_borders_grid(t_tbl)

    col_widths_tbl = [Inches(1.15), Inches(4.32), Inches(0.80)]
    for row in t_tbl.rows:
        for idx, width in enumerate(col_widths_tbl):
            row.cells[idx].width = width

    format_table_row(t_tbl.rows[0], is_header=True)
    tbl_hdr = ['Table No.', 'Title', 'Page No.']
    for idx, title in enumerate(tbl_hdr):
        cell = t_tbl.rows[0].cells[idx]
        set_cell_shading(cell, 'F2F4F7')
        set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx != 1 else WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(title)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)
        r.font.bold = True

    for row_idx, (col0, col1, col2) in enumerate(tables_entries, start=1):
        row = t_tbl.rows[row_idx]
        format_table_row(row, is_header=False)
        for c_idx in range(3):
            cell = row.cells[c_idx]
            set_cell_margins(cell, top=55, bottom=55, left=90, right=90)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

        p0 = row.cells[0].paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p0.paragraph_format.space_before = Pt(0)
        p0.paragraph_format.space_after = Pt(0)
        p0.paragraph_format.line_spacing = 1.15
        r0 = p0.add_run(col0)
        r0.font.name = 'Times New Roman'
        r0.font.size = Pt(10.5)

        p1 = row.cells[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p1.paragraph_format.space_before = Pt(0)
        p1.paragraph_format.space_after = Pt(0)
        p1.paragraph_format.line_spacing = 1.15
        r1 = p1.add_run(col1)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(10.5)

        p2 = row.cells[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after = Pt(0)
        p2.paragraph_format.line_spacing = 1.15
        r2 = p2.add_run(col2)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(10.5)

    primary_path = r'Project Documentation\AutoDev_Capstone_Project_Report.docx'
    backup_path = r'Project Documentation\AutoDev_Capstone_Project_Report_Updated.docx'

    try:
        doc.save(primary_path)
        print('Report updated successfully to primary path:', primary_path)
    except PermissionError:
        doc.save(backup_path)
        print(f'Primary file is locked in Word. Saved to backup path: {backup_path}')

if __name__ == '__main__':
    build_report_preliminaries()
