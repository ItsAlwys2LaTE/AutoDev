import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def append_chapter2():
    doc_path = r'Project Documentation\AutoDev_Capstone_Project_Report.docx'
    backup_path = r'Project Documentation\AutoDev_Capstone_Project_Report_Updated.docx'

    doc = docx.Document(doc_path)

    def add_chapter_header(chap_num_text, chap_title_text):
        doc.add_page_break()
        p_num = doc.add_paragraph()
        p_num.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_num.paragraph_format.space_before = Pt(16)
        p_num.paragraph_format.space_after = Pt(4)
        r_num = p_num.add_run(chap_num_text)
        r_num.font.name = 'Times New Roman'
        r_num.font.size = Pt(16)
        r_num.font.bold = True

        p_title = doc.add_paragraph()
        p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_title.paragraph_format.space_before = Pt(4)
        p_title.paragraph_format.space_after = Pt(24)
        r_title = p_title.add_run(chap_title_text)
        r_title.font.name = 'Times New Roman'
        r_title.font.size = Pt(16)
        r_title.font.bold = True

    def add_h1(heading_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(heading_text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(14)
        r.font.bold = True

    def add_h2(heading_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(heading_text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(12)
        r.font.bold = True

    def add_body(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_after = Pt(6)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(12)

    def add_bullet(bold_prefix, text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.left_indent = Inches(0.25)
        p.paragraph_format.space_after = Pt(6)
        r_bullet = p.add_run('•  ')
        r_bullet.font.name = 'Times New Roman'
        r_bullet.font.size = Pt(12)
        r_bullet.font.bold = True
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.name = 'Times New Roman'
            r_pre.font.size = Pt(12)
            r_pre.font.bold = True
        r_body = p.add_run(text)
        r_body.font.name = 'Times New Roman'
        r_body.font.size = Pt(12)

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

    def set_cell_margins(cell, top=60, bottom=60, left=90, right=90):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
        tcPr.append(tcMar)

    def format_table_row(row, is_header=False):
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
        if is_header:
            trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

    # CHAPTER 2 HEADER
    add_chapter_header('CHAPTER 2', 'LITERATURE REVIEW')

    # 2.1 EVOLUTION OF AUTONOMOUS SOFTWARE ENGINEERING & MULTI-AGENT FRAMEWORKS
    add_h1('2.1 Evolution of Autonomous Software Engineering & Multi-Agent Frameworks')
    add_body(
        'The quest to automate the creation of software systems represents an intellectual journey spanning more than five decades '
        'of computer science research. The paradigm of program synthesis has progressed through four distinct evolutionary epochs, each '
        'defined by fundamental shifts in computational representations, cognitive models, and verification mechanisms:'
    )
    add_bullet(
        'The Deductive and Rule-Based Era (1970s – 1990s): ',
        'Early approaches to automated programming relied fundamentally on formal mathematical logic and deductive reasoning, pioneered by '
        'Manna and Waldinger’s deductive synthesis framework. In this paradigm, software generation was modeled as a constructive theorem-proving '
        'task: given a formal mathematical specification of input-output relations in first-order predicate calculus, an automated theorem prover '
        'extracted an executable algorithm. While deductive synthesis provided absolute mathematical guarantees of functional correctness, it '
        'suffered from severe intractability. Writing complete, non-contradictory formal specifications was frequently more complex and error-prone '
        'than authoring the code manually. Consequently, rule-based systems were confined to micro-domains, toy mathematical functions, and '
        'restricted domain-specific languages (DSLs).'
    )
    add_bullet(
        'The Statistical and Neural Code Completion Era (2010 – 2020): ',
        'The widespread availability of open-source software repositories on GitHub catalyzed the transition toward statistical language '
        'modeling for source code. Early statistical models, such as n-gram representations and probabilistic context-free grammars (PCFGs), '
        'treated source code as structured sequences of syntactic tokens. The subsequent introduction of Recurrent Neural Networks (RNNs), '
        'Long Short-Term Memory (LSTM) networks, and Graph Neural Networks (e.g., Code2Vec) enabled learned vector embeddings of AST nodes. '
        'These models demonstrated utility in local identifier recommendation, method naming, and simple token autocomplete. However, they '
        'remained fundamentally incapable of global architectural reasoning, cross-file context tracking, or synthesizing non-trivial multi-step '
        'algorithms.'
    )
    add_bullet(
        'The Foundational LLM Autocomplete Era (2021 – 2023): ',
        'The scaling of Transformer-based autoregressive Large Language Models (LLMs)—instantiated in architectures such as OpenAI Codex, '
        'GitHub Copilot, StarCoder, and CodeLlama—transformed automated coding from predictive token ranking to coherent natural-language-to-code '
        'synthesis. Trained on hundreds of billions of lines of polyglot source code, foundational models mastered complex syntactic patterns, '
        'idiomatic library usage, and algorithmic scaffolding. However, in software engineering practice, these models operated predominantly '
        'in an open-loop, single-turn autocomplete regime. The model acted as a passive assistant, awaiting developer invocation and producing '
        'isolated snippets without any mechanism to execute, verify, or integrate the code into a multi-tiered repository.'
    )
    add_bullet(
        'The Autonomous Multi-Agent Era (2023 – Present): ',
        'Recognizing the acute limitations of passive, single-turn LLM generation, recent research has pivoted toward autonomous multi-agent '
        'frameworks. Pioneered by systems such as AutoGPT, CAMEL, MetaGPT, and ChatDev, this emerging paradigm transitions from monolithic '
        'prompting to decoupled ensembles of specialized autonomous agents. By assigning distinct cognitive personas (e.g., Architect, Product '
        'Manager, Engineer, QA Reviewer) and orchestrating structured communication protocols, multi-agent frameworks mirror professional '
        'software engineering team dynamics.'
    )
    add_body(
        'Despite their conceptual promise, early multi-agent frameworks exhibit critical structural vulnerabilities that preclude their '
        'deployment for industrial-scale software delivery. First, platforms like ChatDev rely on unconstrained, conversational natural-language '
        'dialogue loops between agents. Over extended generation horizons, these conversational chains inevitably suffer from "semantic drift," '
        'compounding hallucination, and repetitive circular conversational pleasantries. Second, existing architectures predominantly enforce '
        'rigid, linear waterfall pipelines, failing to exploit the inherent concurrency of decoupled software modules. Most critically, early '
        'systems simulate the software development lifecycle purely as a linguistic exercise: agents discuss and output code, but the code is '
        'never compiled, linked, or executed within a real runtime environment. This absence of empirical grounding motivates the development '
        'of AutoDev’s deterministic, graph-scheduled, and sandbox-grounded multi-agent architecture.'
    )

    # 2.2 DIRECTED ACYCLIC GRAPH (DAG) SCHEDULING & CYCLE DETECTION IN PROGRAM SYNTHESIS
    add_h1('2.2 Directed Acyclic Graph (DAG) Scheduling & Cycle Detection in Program Synthesis')
    add_body(
        'In modern software architecture, non-trivial software systems are fundamentally non-linear. An enterprise application rarely comprises '
        'a uniform sequence of instructions; rather, it manifests as a hierarchical network of interdependent modules, such as database relational '
        'schemas, data access layers, asynchronous messaging brokers, RESTful API controllers, authentication middleware, and frontend user interfaces. '
        'In classical software engineering, this relational topology is formally modeled as a Directed Acyclic Graph (DAG) $G = (V, E)$, where each '
        'vertex $v \\in V$ represents a discrete software component and each directed edge $(u, v) \\in E$ denotes a strict dependency relationship '
        'specifying that component $v$ requires the interface or artifacts of component $u$ prior to execution.'
    )
    add_body(
        'In the literature of build automation systems (e.g., GNU Make, Google Bazel, Gradle) and data pipeline orchestration engines (e.g., Apache '
        'Airflow, Celery), DAG scheduling is universally solved through topological sorting algorithms. The foundational algorithm for topological '
        'scheduling is Kahn’s Algorithm, which operates with linear computational complexity $\\mathcal{O}(|V| + |E|)$. Kahn’s formulation iteratively '
        'identifies all vertices with an in-degree of zero (nodes with no unresolved dependencies), enqueues them for parallel execution across '
        'available worker threads, and upon their completion, decrements the in-degree of dependent downstream nodes. In the context of autonomous '
        'software synthesis, applying Kahn’s algorithm allows AutoDev to maximize parallel throughput by concurrently generating independent '
        'architectural tracks (such as a database schema and an independent client presentation module) while ensuring that dependent services '
        '(such as an API controller) are only synthesized after their required data contracts are fully specified.'
    )
    add_body(
        'A critical failure mode unique to autonomous agentic synthesis, however, is the inadvertent creation of cyclic dependencies during '
        'unsupervised architectural decomposition. Because Large Language Models operate probabilistically, the Master Architect agent may '
        'generate circular interface requirements (e.g., Component $A$ requires Component $B$, Component $B$ requires Component $C$, and Component '
        '$C$ requires Component $A$). In a standard topological scheduler, the presence of a directed cycle creates an immediate system deadlock: '
        'no node in the cycle ever reaches an in-degree of zero, causing the scheduler to freeze indefinitely. To resolve this vulnerability, the '
        'literature points to Tarjan’s Strongly Connected Components (SCC) Algorithm. Operating in $\\mathcal{O}(|V| + |E|)$ time using depth-first '
        'search (DFS) traversals and integer low-link indices, Tarjan’s algorithm dynamically partitions the graph into maximal strongly connected '
        'subgraphs. When AutoDev detects an SCC containing more than one vertex, the cycle is flagged as an architectural deadlock, and the platform '
        'triggers an automated cycle-breaking transformation—either by decoupling the cyclic contract through an asynchronous event bus or by '
        'fusing the tightly coupled components into a single atomic synthesis track.'
    )

    # 2.3 DISTRIBUTED STATE SYNCHRONIZATION, MUTEX LOCKING & MONOTONIC EPOCH FENCING
    add_h1('2.3 Distributed State Synchronization, Mutex Locking & Monotonic Epoch Fencing')
    add_body(
        'When multiple autonomous agents execute concurrently across parallel component tracks, the software repository becomes a shared, '
        'concurrently mutated distributed state. In the absence of rigorous synchronization primitives, parallel agent execution inevitably '
        'triggers severe concurrency anomalies well-documented in distributed systems literature:'
    )
    add_bullet(
        'Race Conditions and Lost Updates: ',
        'Multiple CodeGen agents synthesizing distinct modules may attempt to concurrently update shared project-wide configuration manifests '
        '(such as root package dependencies in `package.json`, environment definitions in `.env`, or container mappings in `docker-compose.yml`). '
        'Without mutual exclusion, concurrent write operations cause unsynchronized file overwrites, corrupting project configuration manifests '
        'and resulting in silent dependency loss.'
    )
    add_bullet(
        'Stale Writes and the "Zombie Agent" Problem: ',
        'In an asynchronous multi-agent environment, network latency, varying LLM token generation times, and upstream API retries cause substantial '
        'variance in agent completion times. A CodeGen agent dispatched during an earlier execution epoch may complete its generation task after a '
        'subsequent self-healing critic agent has already identified an error, patched the module, and transitioned the pipeline to a newer stage. '
        'If the lagging "zombie agent" commits its stale code to the file system, it overwrites the verified patch, reverting the repository to a '
        'broken state and inducing infinite debugging loops.'
    )
    add_body(
        'To establish provable concurrency safety, AutoDev draws upon the classical theory of synchronization and deadlock prevention established '
        'by Edward G. Coffman Jr. in 1971. A deadlock can occur if and only if four necessary and sufficient conditions hold simultaneously: '
        '(1) Mutual Exclusion, (2) Hold and Wait, (3) No Preemption, and (4) Circular Wait. AutoDev mathematically eliminates Coffman’s second and '
        'fourth conditions by enforcing an atomic, total-order two-phase locking protocol: agents must declare and acquire all required file-stage '
        'mutexes simultaneously in lexicographical order, precluding the possibility of circular wait chains or partial hold-and-wait deadlocks.'
    )
    add_body(
        'Furthermore, to definitively eliminate stale writes from zombie agents, AutoDev incorporates Martin Kleppmann’s distributed consensus '
        'paradigm of Monotonic Epoch Fencing Tokens. Under this protocol, every state mutation, stage transition, and lock acquisition is tagged '
        'with a monotonically increasing 64-bit integer epoch counter $\\tau_{epoch}$. When an agent attempts to commit an artifact or release a '
        'mutex lease, the underlying repository persistence layer evaluates whether the agent’s token matches the current active epoch. If an '
        'intervening stage transition has incremented the global epoch counter (i.e., $\\tau_{agent} < \\tau_{current}$), the write operation is '
        'atomically fenced, rejected, and logged as an obsolete transaction, thereby preserving repository state integrity across all parallel tracks.'
    )

    # 2.4 SANDBOXED CONTAINER EXECUTION & MULTI-CRITIC AUTOMATED PEER REVIEW
    add_h1('2.4 Sandboxed Container Execution & Multi-Critic Automated Peer Review')
    add_body(
        'A foundational tenet of modern software engineering is that syntactic generation is meaningless without empirical runtime verification. '
        'The academic literature on automated software testing and program repair emphasizes that code correctness can only be established '
        'through dynamic execution against deterministic assertions and environmental constraints. In the domain of autonomous coding, this '
        'necessitates two critical architectural pillars: an isolated, high-performance sandbox execution engine, and an automated multi-critic '
        'peer-review arbitration network.'
    )
    add_body(
        'In evaluating execution environments for untrusted, LLM-generated code, systems research contrasts three primary virtualization paradigms: '
        'full hardware virtualization (e.g., KVM, QEMU), WebAssembly (Wasm) runtime environments, and Linux containerization (Docker, runc). '
        'While hardware virtualization provides maximum isolation, its boot latency (10–30 seconds) and heavy hypervisor resource overhead make '
        'it unviable for rapid, multi-stage agent verification loops. Conversely, WebAssembly offers sub-millisecond instantiation but lacks '
        'support for system-level networking, native package managers (npm, pip, cargo), and multi-tier background services. Docker containerization, '
        'specifically utilizing rootless container runtimes with ephemeral bind mounts, provides the optimal balance. By leveraging Linux kernel '
        'namespaces (mount, pid, net, ipc) and control groups (cgroups), AutoDev instantiates ephemeral sandbox containers within 500 milliseconds, '
        'enforcing strict resource caps (e.g., maximum 2.0 CPU cores, 2048 MB RAM, 120-second timeout) while isolating the host filesystem from '
        'arbitrary code execution.'
    )
    add_body(
        'Within this sandboxed execution environment, AutoDev implements an automated Multi-Critic Peer-Review network inspired by Michael Fagan’s '
        'seminal 1976 formal software inspection methodology. Rather than relying on a single monolithic critic prompt, AutoDev distributes code '
        'inspection across four specialized, decoupled critic agents:'
    )
    add_bullet(
        'AST (Abstract Syntax Tree) Validator: ',
        'Performs instantaneous static parsing using native language compilers (e.g., Python `ast`, Babel parser for TypeScript/JavaScript). '
        'Validates grammatical syntax, detects unclosed delimiter brackets, identifies illegal indentations, and catches unresolvable import '
        'identifiers prior to container execution.'
    )
    add_bullet(
        'Linter & Static Type Critic: ',
        'Executes strict static type checkers (`mypy` for Python, `tsc` for TypeScript) and code quality linters (ESLint, Flake8). Verifies type '
        'signatures, prevents implicit `any` leaks, and flags dead code or uninitialized variables.'
    )
    add_bullet(
        'Semantic Logic & Unit Test Critic: ',
        'Executes the synthesized test harness within the Docker sandbox (`pytest`, `jest`, `vitest`). Inspects exit codes, standard output (stdout), '
        'and standard error (stderr) streams to evaluate functional adherence to the architectural specification.'
    )
    add_bullet(
        'Security Vulnerability Auditor: ',
        'Scans the generated codebase against the OWASP Top 10 vulnerabilities, identifying SQL injection risks, insecure cryptographic primitives, '
        'hardcoded API credentials, and known Common Vulnerabilities and Exposures (CVEs) in third-party package dependencies.'
    )
    add_body(
        'The evaluations of these four critics are submitted to a centralized Consensus Arbiter. Drawing upon the principles of Closed-Loop '
        'Automated Program Repair (APR) and reflective prompt engineering (e.g., the Reflexion framework by Shinn et al., 2023), the Arbiter '
        'synthesizes a structured error diagnostic payload. If defects are detected, this diagnostic trace is fed directly into a targeted '
        'self-healing patch agent, enabling AutoDev to autonomously iterate and repair its own code failures without human intervention.'
    )

    # 2.5 EXISTING SYSTEMS & COMPARATIVE LIMITATIONS
    add_h1('2.5 Existing Systems & Comparative Limitations')
    add_body(
        'To rigorously position AutoDev within the contemporary technological landscape, it is essential to critically evaluate existing '
        'state-of-the-art autonomous software engineering platforms. A comparative analysis reveals distinct strengths alongside critical '
        'architectural limitations across four premier systems:'
    )
    add_bullet(
        'Devin (Cognition AI, 2024): ',
        'Widely recognized as the first commercial autonomous AI software engineer, Devin operates within a full virtual machine shell equipped '
        'with a web browser, code editor, and bash terminal. It demonstrates impressive end-to-end task execution on real-world GitHub issues. '
        'However, Devin represents a completely proprietary, closed-source cloud SaaS product with opaque pricing and closed model routing. '
        'Users cannot inspect its internal reasoning mechanisms, configure custom multi-pool API failover matrices, or deploy the system in '
        'secure, air-gapped on-premise enterprise environments.'
    )
    add_bullet(
        'SWE-agent (Princeton University / Yang et al., 2024): ',
        'Engineered as an academic benchmark harness for the SWE-bench evaluation benchmark, SWE-agent introduces an Agent-Computer Interface '
        '(ACI) that allows an LLM to browse repositories, edit files, and execute shell commands. While highly effective at localized bug-fixing '
        'in existing repositories, SWE-agent is designed strictly for single-issue resolution. It completely lacks greenfield full-stack '
        'architectural blueprinting, possesses no component DAG scheduling engine, and operates exclusively via an unadorned command-line terminal.'
    )
    add_bullet(
        'MetaGPT (DeepWisdom / Hong et al., 2023): ',
        'A pioneering multi-agent framework that encodes human Standard Operating Procedures (SOPs) into agent personas (Product Manager, '
        'Architect, Project Manager, Engineer). MetaGPT demonstrates high proficiency in generating architectural documents, PRDs, and API '
        'specifications. However, MetaGPT lacks an integrated, sandboxed Docker execution engine. It generates code purely as text output without '
        'runtime verification, leaving unit test execution and debugging to the human user. Furthermore, it operates on a linear pipeline model '
        'without dynamic DAG topological scheduling or concurrency mutex locks.'
    )
    add_bullet(
        'AutoGPT (Toran Bruce Richards et al., 2023): ',
        'An open-source general-purpose autonomous agent utilizing recursive goal decomposition and vector memory retrieval. While seminal in '
        'popularizing autonomous agents, AutoGPT suffers from acute task derailment, runaway recursive execution loops, and lacks specialized '
        'software engineering domain critics. It provides no formal concurrency control, no smart API load balancing, and no real-time telemetry IDE.'
    )

    # TABLE 2.1
    p_tbl_cap = doc.add_paragraph()
    p_tbl_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tbl_cap.paragraph_format.space_before = Pt(14)
    p_tbl_cap.paragraph_format.space_after = Pt(6)
    p_tbl_cap.paragraph_format.keep_with_next = True
    r_cap = p_tbl_cap.add_run('Table 2.1: Comparative Feature Analysis of Autonomous Software Engineering Platforms')
    r_cap.font.name = 'Times New Roman'
    r_cap.font.size = Pt(11)
    r_cap.font.bold = True

    table_data = [
        ['Feature / Architectural Dimension', 'Devin (Cognition)', 'SWE-agent (Princeton)', 'MetaGPT (DeepWisdom)', 'AutoGPT (Richards)', 'AutoDev (Proposed Platform)'],
        ['Primary Target Domain', 'Autonomous SWE SaaS', 'Benchmark Bug Repair', 'SOP Software Modeling', 'General-Purpose Agent', 'Full-Stack Autonomous SDLC'],
        ['Multi-Agent Role Decoupling', 'Single Agent + Sub-tools', 'Single Agent (ACI)', 'Multi-Agent (Role Personas)', 'Single Agent + Sub-tasks', 'Decoupled Multi-Agent Ensemble'],
        ['Architectural Dependency Scheduling', 'Sequential / Ad-hoc', 'None (Single-Issue)', 'Linear Waterfall Chain', 'Unstructured Task Queue', 'Topological DAG (Kahn + Tarjan SCC)'],
        ['Concurrency Safety & Deadlock Prevention', 'Virtual Machine Lock', 'Sequential Execution', 'None (Sequential Only)', 'None (Thread Unsafe)', 'Lease Mutexes + Epoch Fencing'],
        ['API Key Balancer & Quota Management', 'Proprietary Cloud Pool', 'Single Static API Key', 'Single Static API Key', 'Single Static API Key', 'Smart Multi-Pool Chi-Square (χ²) Balancer'],
        ['Sandboxed Execution Environment', 'Full Cloud VM (Custom)', 'Docker Subprocess', 'None (Static Generation)', 'Local OS Subprocess', 'Rootless Docker Engine (cgroups)'],
        ['Automated Peer-Review Critics', 'Self-Inspection Loop', 'Test Harness Execution', 'None (Static Text Only)', 'Self-Prompt Reflection', 'Decoupled 4-Critic Arbitration Network'],
        ['Closed-Loop Self-Healing', 'Yes (VM Shell Loop)', 'Yes (Patch Iteration)', 'No (Manual Debugging)', 'Unstable Recursive Loops', 'Deterministic AST/Test Repair Loop'],
        ['Dual Operational Paradigms', 'No (Single Paradigm)', 'No (Issue Repair Only)', 'No (Single Waterfall)', 'No (Unbounded Loop)', 'Single-Pass SDLC & Parallel DAG Engine'],
        ['User Interface & Telemetry Layer', 'Proprietary Web UI', 'Raw CLI Terminal', 'CLI / Static HTML Docs', 'CLI / Basic Web Wrapper', 'Translucent Web Console + Monaco IDE + SSE'],
        ['Open-Source & Self-Hostability', 'No (Proprietary SaaS)', 'Yes (Open Source)', 'Yes (Open Source)', 'Yes (Open Source)', 'Yes (Fully Self-Hostable)']
    ]

    tbl_comp = doc.add_table(rows=len(table_data), cols=6)
    tbl_comp.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_comp.autofit = False
    set_table_borders_grid(tbl_comp)

    # Usable width: 6.27 inches
    # Col widths: 1.57 in, 0.94 in, 0.94 in, 0.94 in, 0.94 in, 0.94 in = 6.27 in
    col_widths_comp = [Inches(1.57), Inches(0.94), Inches(0.94), Inches(0.94), Inches(0.94), Inches(0.94)]
    for row in tbl_comp.rows:
        for idx, width in enumerate(col_widths_comp):
            row.cells[idx].width = width

    format_table_row(tbl_comp.rows[0], is_header=True)
    for idx, heading in enumerate(table_data[0]):
        cell = tbl_comp.rows[0].cells[idx]
        set_cell_shading(cell, 'F2F4F7')
        set_cell_margins(cell, top=60, bottom=60, left=60, right=60)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx != 0 else WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(heading)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(9.5)
        r.font.bold = True

    for r_idx, row_values in enumerate(table_data[1:], start=1):
        row = tbl_comp.rows[r_idx]
        format_table_row(row, is_header=False)
        for c_idx, val in enumerate(row_values):
            cell = row.cells[c_idx]
            set_cell_margins(cell, top=45, bottom=45, left=50, right=50)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if c_idx != 0 else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(val)
            r.font.name = 'Times New Roman'
            r.font.size = Pt(9.0)
            if c_idx == 5:
                r.font.bold = True
            elif c_idx == 0:
                r.font.bold = True

    add_body(
        'As evidenced by the rigorous comparative synthesis in Table 2.1, AutoDev addresses the structural limitations that impede contemporary '
        'autonomous coding systems. By uniting topological DAG scheduling, provable deadlock-free concurrency control, an empirical rootless Docker '
        'sandbox, multi-critic arbitration, and a hardware-accelerated translucent web console with Monaco IDE telemetry, AutoDev establishes '
        'a new benchmark for autonomous, production-grade software repository delivery.'
    )

    try:
        doc.save(doc_path)
        print('Chapter 2 appended successfully to primary document:', doc_path)
    except PermissionError:
        doc.save(backup_path)
        print(f'Primary document locked in Word. Saved to backup path: {backup_path}')

if __name__ == '__main__':
    append_chapter2()
