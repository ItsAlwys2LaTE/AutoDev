#bAutoDev:bMasterbTechnicalbArchitectureb&bSystembDocumentation

>b**DocumentbVersion**:b2.2.1-Prodb(MasterbEdition)bb
>b**RepositorybRoot**:b`c:\Users\AnupambSharma\Documents\AutoDev\AutoDev-main`bb
>b**PrimarybAuthorb&bMaintainer**:bAnupambSharmabb
>b**SystembClassification**:bAutonomousbMulti-AgentbSoftwarebEngineeringbPlatformbb
>b**CommitbSpan**:b`c80d011`b(Commitb#01)btob`5502746`b(Commitb#78,b`HEADb->bmain`)bb
>b**TargetbRuntimes**:bPythonb3.11+,bFastAPI,bUvicorn,bLangGraph,bDockerbEngine,bVanillabES6+bWebbDashboard,bMonacobEditorbb
>b**VerificationbStatus**:bFormallybVerifiedbacrossb4bIntegrationbTiersb&bAdversarialbStressbSuitesbb

---

##bTablebofbContents

1.b[ExecutivebArchitecturebOverview](#1-executive-architecture-overview)
bbb-b1.1b[CorebMissionb&bSystembParadigm](#11-core-mission--system-paradigm)
bbb-b1.2b[Multi-AgentbCollaborationbArchitecture](#12-multi-agent-collaboration-architecture)
bbb-b1.3b[Component-WisebPipelinedbExecutionbModel](#13-component-wise-pipelined-execution-model)
bbb-b1.4b[High-LevelbTopologyb&bDatabFlow](#14-high-level-topology--data-flow)
2.b[TimelinebFormatb&bChronologicalbEvolutionb(78bCommitsbAcrossb9bEras)](#2-timeline-format--chronological-evolution-78-commits-across-9-eras)
bbb-b2.1b[Erab1:bInitialbFoundationalbArchitectureb&bRequirementsbModelingb(Phaseb1)](#21-era-1-initial-foundational-architecture--requirements-modeling-phase-1)
bbb-b2.2b[Erab2:bFullbSDLCbArchitecture,bAutonomousbCodeGenb&bSubprocessbSandboxb(Phaseb2)](#22-era-2-full-sdlc-architecture-autonomous-codegen--subprocess-sandbox-phase-2)
bbb-b2.3b[Erab3:bMulti-AgentbArbitrationbNetworkb&bClosed-LoopbSelf-Correctionb(Phaseb3)](#23-era-3-multi-agent-arbitration-network--closed-loop-self-correction-phase-3)
bbb-b2.4b[Erab4:bRich-TextbDocuments,bReal-TimebSSEbStreamingb&bMonacobIDEb(BUILDbSYSbv1.3.0.Alpha)](#24-era-4-rich-text-documents-real-time-sse-streaming--monaco-ide-build-sys-v130alpha)
bbb-b2.5b[Erab5:bCriticbHardening,bDocumentationbAgentb&bAPIbKeybBalancerb(BUILDbSYSbv1.3.1.Alpha)](#25-era-5-critic-hardening-documentation-agent--api-key-balancer-build-sys-v131alpha)
bbb-b2.6b[Erab6:bPolyglotbSDLCb&bUniversalbDockerbSandboxbEnginebv2.0b(BUILDbSYSbv1.4.0.Alphabtobv2.0)](#26-era-6-polyglot-sdlc--universal-docker-sandbox-engine-v20-build-sys-v140alpha-to-v20)
bbb-b2.7b[Erab7:bComponent-WisebPipelinedbArchitecturebv2.1.0b&bModularbOrchestration](#27-era-7-component-wise-pipelined-architecture-v210--modular-orchestration)
bbb-b2.8b[Erab8:bMathematicalbDAGbPipelinebEnginebIntegrationb(`backend/autodev_pipeline`)](#28-era-8-mathematical-dag-pipeline-engine-integration-backendautodev_pipeline)
bbb-b2.9b[Erab9:bProductionbHardening,bConcurrencybBugbFixesb&bUIbPolishb(HEADb/bv2.2.1-Prod)](#29-era-9-production-hardening-concurrency-bug-fixes--ui-polish-head--v221-prod)
bbb-b2.10b[ComprehensivebMilestoneb&bVersionbMatrix](#210-comprehensive-milestone--version-matrix)
3.b[Deep-Dive:bCorebAlgorithmb1b—bParallelbComponentbPipelinebSchedulerb&bDAGbEngine](#3-deep-dive-core-algorithm-1--parallel-component-pipeline-scheduler--dag-engine)
bbb-b3.1b[TheoreticalbMotivationb&bConcurrencybChallenges](#31-theoretical-motivation--concurrency-challenges)
bbb-b3.2b[Graph-TheoreticbFoundationsb&b`PipelineDAG`](#32-graph-theoretic-foundations--pipelinedag)
bbb-b3.3b[Kahn'sbTopologicalbSortb&bLayeredbParallelbScheduling](#33-kahns-topological-sort--layered-parallel-scheduling)
bbb-b3.4b[Tarjan'sbStronglybConnectedbComponentsb(SCC)b&bCyclebExtraction](#34-tarjans-strongly-connected-components-scc--cycle-extraction)
bbb-b3.5b[DeterministicbCyclebResolutionbPoliciesb(`ABORT`,b`SAFE_STALL`,b`FEEDBACK_ARC_SET_STUB`)](#35-deterministic-cycle-resolution-policies-abort-safe_stall-feedback_arc_set_stub)
bbb-b3.6b[FinitebStatebMachineb&bComponentbAutomatab(`ComponentStatus`)](#36-finite-state-machine--component-automata-componentstatus)
bbb-b3.7b[ConcurrencybControlb&bMonotonicbEpochbFencingb(`StageMutex`,b`StageLockManager`)](#37-concurrency-control--monotonic-epoch-fencing-stagemutex-stagelockmanager)
bbb-b3.8b[EliminationbofbCoffman'sbDeadlockbConditionsb&bAtomicb2-PhasebHandover](#38-elimination-of-coffmans-deadlock-conditions--atomic-2-phase-handover)
bbb-b3.9b[PrioritybQueuebMin-HeapbDispatchingb(`StageQueueManager`)](#39-priority-queue-min-heap-dispatching-stagequeuemanager)
bbb-b3.10b[DiscretebTickbMechanicsb(`PipelineScheduler.step()`b&b`/api/pipeline/tick`)](#310-discrete-tick-mechanics-pipelineschedulerstep--apipipelinetick)
bbb-b3.11b[FaultbTolerance,bMulti-TierbWatchdogsb&bPoison-PillbIsolation](#311-fault-tolerance-multi-tier-watchdogs--poison-pill-isolation)
bbb-b3.12b[Write-AheadbStatebStoreb(WASS)b&bDeterministicbCrashbRecovery](#312-write-ahead-state-store-wass--deterministic-crash-recovery)
bbb-b3.13b[ForensicbAnalysisb&bRoot-CausebResolutionbofbConcurrencybHangs](#313-forensic-analysis--root-cause-resolution-of-concurrency-hangs)
4.b[Deep-Dive:bCorebAlgorithmb2b—bSmartbAPIbKeybBalancerbSubsystem](#4-deep-dive-core-algorithm-2--smart-api-key-balancer-subsystem)
bbb-b4.1b[ArchitecturalbOverviewb&bMulti-PoolbTopology](#41-architectural-overview--multi-pool-topology)
bbb-b4.2b[3-TierbEnvironmentbDiscoverybHierarchy](#42-3-tier-environment-discovery-hierarchy)
bbb-b4.3b[StrictbStagebIsolationbGuardb(`StrictStageReservationGuard`)](#43-strict-stage-isolation-guard-strictstagereservationguard)
bbb-b4.4b[DynamicbHealthbTracking,bErrorbClassificationb&bExponentialbCooldownbDecay](#44-dynamic-health-tracking-error-classification--exponential-cooldown-decay)
bbb-b4.5b[PluggablebLoad-BalancingbStrategiesb&bSelectionbAlgorithms](#45-pluggable-load-balancing-strategies--selection-algorithms)
bbb-b4.6b[Multi-TierbFallbackbMatrixbEngine](#46-multi-tier-fallback-matrix-engine)
bbb-b4.7b[UniversalbExponentialbBackoffbDecoratorb(`backend/retry.py`)](#47-universal-exponential-backoff-decorator-backendretrypy)
bbb-b4.8b[ExhaustionbFailurebModesb&bDiagnosticbTelemetry](#48-exhaustion-failure-modes--diagnostic-telemetry)
bbb-b4.9b[StatisticalbTelemetryb&bChi-SquarebFairnessbVerification](#49-statistical-telemetry--chi-square-fairness-verification)
5.b[FullbTechnicalbSpecifications:bBackendbAPIbRoutes](#5-full-technical-specifications-backend-api-routes)
bbb-b5.1b[EndpointbCatalogb(16bRoutes)](#51-endpoint-catalog-16-routes)
bbb-b5.2b[DetailedbRoutebSpecificationsb&bSchemas](#52-detailed-route-specifications--schemas)
bbb-b5.3b[PydanticbDomainbModelsbReference](#53-pydantic-domain-models-reference)
6.b[FullbTechnicalbSpecifications:bFrontendbUIbArchitectureb&bLogic](#6-full-technical-specifications-frontend-ui-architecture--logic)
bbb-b6.1b[ClientbComponentbHierarchyb&bLayoutbStructure](#61-client-component-hierarchy--layout-structure)
bbb-b6.2b[FrontendbStatebMachineb&bStagebProgressionbAutomata](#62-frontend-state-machine--stage-progression-automata)
bbb-b6.3b[PollingbLoop,bSSEbLogbStreamb&bEventbHandling](#63-polling-loop-sse-log-stream--event-handling)
bbb-b6.4b[EmbeddedbMonacobEditor,bLivebDockerbPreviewb&bSecuritybControls](#64-embedded-monaco-editor-live-docker-preview--security-controls)
7.b[Verificationb&bTestbSuitebDocumentation](#7-verification--test-suite-documentation)
bbb-b7.1b[AutomatedbIntegrationbSuiteb(`test_pipeline_flow.py`)](#71-automated-integration-suite-test_pipeline_flowpy)
bbb-b7.2b[EmpiricalbStressb&bChallengerbSuiteb(`test_pipeline_stress_challenge.py`)](#72-empirical-stress--challenger-suite-test_pipeline_stress_challengepy)
bbb-b7.3b[Decoratorb&bResiliencebUnitbSuiteb(`test_backoff.py`)](#73-decorator--resilience-unit-suite-test_backoffpy)
bbb-b7.4b[FormalbVerificationbExecutionbProcedures](#74-formal-verification-execution-procedures)

---

##b1.bExecutivebArchitecturebOverview

###b1.1bCorebMissionb&bSystembParadigm

AutoDevbisbanbautonomous,bfull-stackbSoftwarebDevelopmentbLifebCycleb(SDLC)bengineeringbplatform.bRatherbthanbactingbasbabsimplebprompt-and-responsebcodebgenerator,bAutoDevbmodelsbthebmulti-phasebengineeringbmethodologybofbhigh-performingbhumanbengineeringbteams:

```
[bNaturalbLanguagebFeaturebRequestb]
bbbbbbbbbbbbbbbb│
bbbbbbbbbbbbbbbb▼
[bPhaseb1:bRequirementsbModelingbAgentb]b──────>bRequirementsDocumentb(PydanticbSchema)
bbbbbbbbbbbbbbbb│
bbbbbbbbbbbbbbbb▼
[bPhaseb1.5:bMasterbArchitectbAgentb]b──────────>bComponentDecompositionb(DAGbDefinition)
bbbbbbbbbbbbbbbb│
bbbbbbbbbbbbbbbb▼
[bMathematicalbParallelbDAGbEngineb]b──────────>bKahnbPartitioningb&bStageMutexbAllocation
bbbbbbbbbbbbbbbb│
bbbbb┌──────────┴──────────┐
bbbbb▼bbbbbbbbbbbbbbbbbbbbb▼
[bComponentbTrackb1b]b[bComponentbTrackbNb]
bbbbb│bbbbbbbbbbbbbbbbbbbbb│
bbbbb├─bDESIGNb(SystemDesignBlueprint)
bbbbb├─bCODEGENb(GeneratedCodeBaseb&bUnitbTests)
bbbbb└─bCRITICSb(DockerbSandboxb+b3bLangGraphbPeerbReviewersb+bChiefbAdjudicator)
bbbbb│bbbbbbbbbbbbbbbbbbbbb│
bbbbb└──────────┬──────────┘
bbbbbbbbbbbbbbbb▼
[bPhaseb4:bIntegratorbAgentb]b─────────────────>bUnifiedbIntegratedbCodebaseb&bEnd-to-EndbTests
bbbbbbbbbbbbbbbb│
bbbbbbbbbbbbbbbb▼
[bPhaseb5:bDocumentationbAgentb]b──────────────>bREADME.md,bArchitecturebSpecsb&bProductionbZIP
```

###b1.2bMulti-AgentbCollaborationbArchitecture

Thebplatformbpartitionsbsoftwarebengineeringbresponsibilitiesbintobspecializedbagentbpersonas:

1.b**RequirementsbModelingbAgentb(`backend/agents/requirements_agent.py`)**:bTransformsbunstructured,bnatural-languagebideasbintobstructuredbrequirementsbfeaturingbuserbstories,bfunctionalbcriteria,bnon-functionalbconstraints,bandbacceptancebcriteria.
2.b**MasterbArchitectbAgentb(`backend/agents/master_architect.py`)**:bAssessesbproductbcomplexity.bWhenbabsystembcomprisesbmultiplebdistinctbdomains,bitbpartitionsbrequirementsbintobmodular,blooselybcoupledbcomponentsbwithbexplicitbdependencybedges.
3.b**SystembDesignbBlueprintbAgentb(`backend/agents/design_agent.py`)**:bAuthorsbcomprehensivebarchitecturalbblueprintsbcontainingbfilebhierarchies,bmodulebpurposes,btechnicalbdependencies,bDockerbcontainerbimages,btestbrunnerbcommands,bandbalgorithmicbpseudocode.
4.b**AutonomousbCodeGenbAgentb(`backend/agents/codegen_agent.py`)**:bWritesbproduction-readybpolyglotbcodebandbunitbtestsbadheringbtobblueprintbspecificationsbandbstrictbtypingbrequirements.bSupportsbautonomousbself-healingbviabrevisionbplans.
5.b**Multi-CriticbArbitrationbNetworkb(`backend/agents/critics.py`)**:
bbb-b**CorrectnessbCriticb(Geminib3.6-flash)**:bAnalyzesbtestbexecutionblogs,bassertionbfailures,bexitbcodes,bandbcoveragebmetrics.
bbb-b**ArchitecturebCriticb(Mistralb`mistral-small-latest`b/bGeminibfallback)**:bVerifiesbadherencebtobblueprintbfilebhierarchies,bstructuralbpatterns,bandbdefensivenessbrules.
bbb-b**CompletenessbCriticb(Geminib3.6-flash)**:bScrutinizesbedgebcases,bnullbboundaries,bdivide-by-zerobvulnerabilities,bandbinputbsanitization.
6.b**ChiefbSoftwarebAdjudicatorb(`backend/orchestrator.py`)**:bSynthesizesbmulti-criticbreportsbusingbLangGraphbintobabconsolidatedbverdictb(`pass`,b`revise`,borb`error`)bandbproducesbstructured,bactionablebrevisionbplans.
7.b**IntegratorbAgentb(`backend/agents/integrator_agent.py`)**:bStitchesbindependentlybverifiedbcomponentbcodebasesbintobabcohesivebrepository,bresolvingbcross-modulebimportbpathsbandbgeneratingbend-to-endbintegrationbtests.
8.b**DocumentationbAgentb(`backend/agents/documentation_agent.py`)**:bGeneratesbproduction-readyb`README.md`bandb`USER_GUIDE.md`bspecificationsbuponbpipelinebcompletion.

###b1.3bComponent-WisebPipelinedbExecutionbModel

Forbnon-trivialbapplications,bmonolithicbsingle-promptbcodebgenerationbfailsbduebtobLLMbcontextblimitsbandbcombinatorialbexplosion.bAutoDevbemploysbab**Component-WisebPipelinedbArchitectureb(v2.1.0+)**:
-bSoftwarebprojectsbarebpartitionedbintobabDirectedbAcyclicbGraphb(DAG)bofbcomponentsb$Cb=b\{c_1,bc_2,b\dots,bc_n\}$.
-bEachbcomponentbexecutesbindependentlybthroughb3bunitbstages:b$\text{DESIGN}b\tob\text{CODEGEN}b\tob\text{CRITICS}$.
-bConcurrencybacrossbstagesbisbgovernedbbybab**DiscretebDAGbPipelinebScheduler**,ballowingbindependentbcomponentsbtobadvancebinbparallelbacrossbdifferentbpipelinebstagesbwithoutbracebconditions.

###b1.4bHigh-LevelbTopologyb&bDatabFlow

```
+====================================================================================================+
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbAUTODEVbFULL-STACKbTOPOLOGYbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
+====================================================================================================+
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+----------------------------------------------------------------------------------------------+bb|
|bb|bbbbbbbbbbbbbbbbbBROWSERbCLIENTbDASHBOARDb(backend/index.htmlb-bES6b/bTailwind)bbbbbbbbbbbbbbb|bb|
|bb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bb|
|bb|bb+------------------------+bb+---------------------------+bb+-----------------------------+bb|bb|
|bb|bb|b5-StagebStepperbHeaderb|bb|bComponentbVisualizerbGridb|bb|bEmbeddedbMonacobIDEbbbbbbbbb|bb|bb|
|bb|bb|bReal-TimebCostbTrackerb|bb|bHorizontalbCarouselbCardsb|bb|bMulti-FilebDiffbViewerbbbbbb|bb|bb|
|bb|bb+------------------------+bb+---------------------------+bb+-----------------------------+bb|bb|
|bb|bbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbb|bb|
|bb|bbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbb|bb|
|bb|bb+----------------------------------------------------------------------------------------+bb|bb|
|bb|bb|bbbbbbbbbbbbbLivebSSEbLogbStreambDrawerb&bDockerbInteractivebPreviewbSandboxbbbbbbbbbbbb|bb|bb|
|bb|bb+----------------------------------------------------------------------------------------+bb|bb|
|bb+----------------------------------------------------------------------------------------------+bb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbbHTTPbRESTb/bSSEbStreambb│bbPollingbLoopb(/api/pipeline/tick)bbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+----------------------------------------------------------------------------------------------+bb|
|bb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbFASTAPIbAPPLICATIONb(backend/main.py)bbbbbbbbbbbbbbbbbbbbbbbbbb|bb|
|bb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bb|
|bb|bb+---------------------+bbb+-----------------------+bbb+----------------------------------+bb|bb|
|bb|bb|bCorebWorkflowbAPIsbb|bbb|bConcurrencyb&bDAGbAPIb|bbb|bLogbStreamb&bSecuritybRouterbbbbb|bb|bb|
|bb|bb|b/api/generate-*bbbbb|bbb|b/api/pipeline/*bbbbbbb|bbb|b/api/logs/stream,bPromptGuardbbbb|bb|bb|
|bb|bb+---------------------+bbb+-----------------------+bbb+----------------------------------+bb|bb|
|bb+----------------------------------------------------------------------------------------------+bb|
|bbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+--------------------------------------------+bbbbb+-------------------------------------------+bb|
|bb|bbbAUTODEVbDAGbENGINEb(backend/autodev_...)b|bbbbb|bbSMARTbAPIbKEYbBALANCERb(autodev_balancer)|bb|
|bb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bb|
|bb|bb-bPipelineDAGb(Kahnb/bTarjanbSCCb/bFAS)bbb|bbbbb|bb-bKeyPoolManagerb(6xbGemini,b1xbMistral)b|bb|
|bb|bb-bStageLockManagerb(StageMutexb+bEpoch)bbb|bbbbb|bb-bStrictStageReservationGuardb(Mistral)bb|bb|
|bb|bb-bStageQueueManagerb(Min-Heapb+b-10kbRev)b|bbbbb|bb-bHealthTrackerb(ExponentialbCooldown)bbb|bb|
|bb|bb-bStageHandoverProtocolb(2-PhasebHandover)|bbbbb|bb-bFallbackMatrixEngineb(3.6b->b3.5b->bLite)|
|bb|bb-bWASSbJournalb&bCrashRecoveryEnginebbbbb|bbbbb|bb-bUniversalbBackoffb(@with_backoff)bbbbbb|bb|
|bb+--------------------------------------------+bbbbb+-------------------------------------------+bb|
|bbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+--------------------------------------------+bbbbb+-------------------------------------------+bb|
|bb|bbbbbbbDOCKERbEXECUTIONbSANDBOXbENGINEbbbbbb|bbbbb|bbbbbbbbbMULTI-MODELbCLOUDbPROVIDERSbbbbbbb|bb|
|bb|bb-bEphemeralbContainerbIsolationbbbbbbbbbb|bbbbb|bb-bGooglebGeminib(gemini-3.6-flash,betc.)b|bb|
|bb|bb-bAuto-DependencybInjectionb(npmb/bpip)bbb|bbbbb|bb-bMistralbAIb(mistral-small-latest)bbbbbb|bb|
|bb|bb-bDynamicbLivebPreviewbPortbForwardingbbbb|bbbbb|bb-bGroqbOpen-WeightbInfrastructurebbbbbbbb|bb|
|bb+--------------------------------------------+bbbbb+-------------------------------------------+bb|
+====================================================================================================+
```

---

##b2.bTimelinebFormatb&bChronologicalbEvolutionb(78bCommitsbAcrossb9bEras)

ThebAutoDevbcodebasebrepresentsb27bdaysbofbcontinuousbevolutionarybdevelopmentb(`2026-08-03`btob`2026-08-29`),bcomprisingb**78bcommits**borganizedbacrossb**9barchitecturalberas**.

```
bbbAugb03bbbbbbbbbbbbbbAugb15bbbbbbbbbbbbbbAugb26-27bbbbbbbbbbbAugb27b(AM)bbbbbbbbbAugb27b(PM)
┌───────────┐bbbbbbb┌───────────┐bbbbbbb┌───────────┐bbbbbbb┌───────────┐bbbbbbb┌───────────┐
│bbbErab1bbb│──────>│bbbErab2bbb│──────>│bbbErab3bbb│──────>│bbbErab4bbb│──────>│bbbErab5bbb│
│bbPhaseb1bb│bbbbbbb│bbPhaseb2bb│bbbbbbb│bbPhaseb3bb│bbbbbbb│bRichbTextb│bbbbbbb│bBalancerbb│
│bbv0.1.0bbb│bbbbbbb│bbv0.2.0bbb│bbbbbbb│bbv1.0-1.1b│bbbbbbb│bbv1.2-1.3b│bbbbbbb│bbv1.3.1bbb│
└───────────┘bbbbbbb└───────────┘bbbbbbb└───────────┘bbbbbbb└───────────┘bbbbbbb└───────────┘
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│
bbbAugb29b(Prod)bbbbbbbAugb29b(AM)bbbbbbbbbAugb28-29bbbbbbbbbbbAugb27-28bbbbbbbbbbbbbb│
┌───────────┐bbbbbbb┌───────────┐bbbbbbb┌───────────┐bbbbbbb┌───────────┐bbbbbbbbbbbbb│
│bbbErab9bbb│<──────│bbbErab8bbb│<──────│bbbErab7bbb│<──────│bbbErab6bbb│<────────────┘
│bHardeningb│bbbbbbb│bDAGbEngine│bbbbbbb│bComponentb│bbbbbbb│bDocker2.0b│
│bbv2.2.1bbb│bbbbbbb│bbv2.2.0bbb│bbbbbbb│bbv2.1.0bbb│bbbbbbb│bbv1.4-2.0b│
└───────────┘bbbbbbb└───────────┘bbbbbbb└───────────┘bbbbbbb└───────────┘
```

---

###b2.1bErab1:bInitialbFoundationalbArchitectureb&bRequirementsbModelingb(Phaseb1)
-b**Timeframe**:b2026-08-03
-b**MilestonebVersion**:b`v0.1.0-alpha`
-b**Focus**:bGenesisbofbAutoDev,bPydanticbschemabformalization,bFastAPIbbackendbscaffolding,bRequirementsbAgent.

####bCommits
*b**Commitb#01b`[c80d011]`**b(*2026-08-03b23:10:31b+0530*):b`Initialbcommit`
bb-b*Author*:bAnupambSharmab|b*Files*:b`README.md`b(+2blines)
bb-b*Context*:bInitializedbgitbrepositorybbaselinebandbmissionbstatement.
*b**Commitb#02b`[5e2d61d]`**b(*2026-08-03b23:12:09b+0530*):b`Phase-1:bRequirementsbModel`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/requirements_agent.py`,b`backend/index.html`,b`backend/main.py`,b`backend/models.py`,b`backend/requirements.txt`b(+229blines)
bb-b*Implementation*:bCreatedbPhase-1bRequirementsbModelingbAgentbusingbGooglebGeminibAPIb(`gemini-1.5-pro`/`gemini-pro`).bBuiltbPydanticbmodelsb(`RequirementsDocument`,b`UserStory`,b`AcceptanceCriteria`)bandbFastAPIbendpointb`POSTb/api/generate-requirements`.
*b**Commitb#03b`[ec1a055]`**b(*2026-08-03b23:15:24b+0530*):b`Addbfilesbviabupload`
bb-b*Author*:bAnupambSharmab|b*Files*:b`README.md`b(+84,b-2blines)
bb-b*Implementation*:bAddedbcomprehensivebinstallationbguidebcoveringbPythonb3.10+bprerequisites,benvironmentbvariables,bandbGeminibAPIbsetup.
*b**Commitb#04b`[b7b5441]`**b(*2026-08-03b23:16:23b+0530*):b`UpdatebREADME.md`
bb-b*Author*:bAnupambSharmab|b*Files*:b`README.md`b(+2,b-4blines)
bb-b*Implementation*:bFormattedbmarkdownblayoutbandbbadgebreferences.

---

###b2.2bErab2:bFullbSDLCbArchitecture,bAutonomousbCodeGenb&bSubprocessbSandboxb(Phaseb2)
-b**Timeframe**:b2026-08-15
-b**MilestonebVersion**:b`v0.2.0-alpha`
-b**Focus**:bSystembDesignbBlueprintbAgent,bCodebGenerationbAgent,bLocalbSubprocessbExecutor.

####bCommits
*b**Commitb#05b`[059979f]`**b(*2026-08-15b23:49:03b+0530*):b`Phase-2bfinalbcommit`
bb-b*Author*:bAnupambSharmab|b*Files*:b9bfilesb(+621,b-103blines)
bb-b*Implementation*:bCreatedb`backend/agents/design_agent.py`b(`SystemDesignBlueprint`bschema),b`backend/agents/codegen_agent.py`b(`GeneratedCodeBase`bschema),b`backend/executor.py`b(subprocessbtestbrunner),bandbendpointsb`POSTb/api/generate-design`,b`POSTb/api/generate-code`,b`POSTb/api/execute-code`.
bb-b*SystembImpact*:bCompletedbthebend-to-endbSDLCbgenerationbloop:bRequirementsb$\to$bBlueprintb$\to$bMulti-FilebCodebaseb$\to$bAutomatedbPytestbVerification.
*b**Commitb#06b`[85dcb7c]`**b(*2026-08-15b23:49:47b+0530*):b`UpdatebREADME.md`
bb-b*Author*:bAnupambSharmab|b*Files*:b`README.md`b(-1bline)
bb-b*Implementation*:bCleanedbupbPhaseb2bsetupbinstructions.

---

###b2.3bErab3:bMulti-AgentbArbitrationbNetworkb&bClosed-LoopbSelf-Correctionb(Phaseb3)
-b**Timeframe**:b2026-08-26btob2026-08-27b(EarlybMorning)
-b**MilestonebVersion**:b`v1.0.0-alpha`btob`v1.1.0-alpha`
-b**Focus**:bLangGraphb3-CriticbArbitrationbNetwork,bChiefbSoftwarebAdjudicator,bAutonomousbSelf-CorrectionbLoop.

####bCommits
*b**Commitb#07b`[afdb38b]`**b(*2026-08-26b23:35:49b+0530*):b`feat:bPhaseb3bArbitrationbEngine,bupdatedbUI,bandbGeminib3.7bmodelbsupport`
bb-b*Author*:bAnupambSharmab|b*Files*:b9bfilesb(+499,b-76blines)
bb-b*Implementation*:bImplementedb`backend/agents/critics.py`bfeaturingbthreebindependentbcriticsb(CorrectnessbonbGemini,bArchitecturebonbMistral/Groq,bCompletenessbonbGroq)bandb`backend/orchestrator.py`bimplementingbabLangGraphb`StateGraph`barbitrationbnetworkbfanningbintobthebChiefbSoftwarebAdjudicator.
*b**Commitb#08b`[bc5add7]`**b(*2026-08-26b23:48:23b+0530*):b`docs:bUpdatebREADMEbwithbmissingbCriticbenvironmentbvariablesbandbcorrectbPhaseb4/5broadmapbmilestones`
bb-b*Author*:bAnupambSharmab|b*Files*:b`README.md`b(+9,b-3blines)
bb-b*Implementation*:bDocumentedb`GEMINI_API_KEY`,b`MISTRAL_API_KEY`,bandb`GROQ_API_KEY`.
*b**Commitb#09b`[3073ede]`**b(*2026-08-26b23:58:50b+0530*):b`chore:bRollbackbprimarybmodelsbfromb3.7-flashbtob3.6-flashbduebtobAPIbavailabilitybissues`
bb-b*Author*:bAnupambSharmab|b*Files*:b9bfilesb(+9,b-9blines)
bb-b*RootbCause*:bUpstreambGooglebGenAIbendpointsbreturnedb503bUNAVAILABLEbforb`gemini-3.7-flash`.
bb-b*Fix*:bStandardizedbprimarybinferencebmodelsbonbstableb`gemini-3.6-flash`.
*b**Commitb#10b`[d2d37c2]`**b(*2026-08-27b00:16:58b+0530*):b`feat:bImplementedbautonomousbSelf-CorrectionbloopbbetweenbPhaseb3bandbPhaseb2b`
bb-b*Author*:bAnupambSharmab|b*Files*:b3bfilesb(+72,b-7blines)
bb-b*Implementation*:bAddedb`revision_count`bandb`revision_plan`bparametersbtob`codegen_agent.py`bandb`index.html`,bestablishingbanbautomatedb3-iterationbself-healingbloopbwhenbthebAdjudicatorbreturnsbab`revise`bverdict.
*b**Commitb#11b`[e126db0]`**b(*2026-08-27b01:04:57b+0530*):b`fix:bResolvebGroqbAPIbJSONbvalidationberrorbbybupdatingbmodelbnamebandbstrictbJSONbsystembprompt`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+2,b-2blines)
bb-b*Fix*:bInjectedbstrictbJSONbschemabconstraintsbintobGroqbpromptsbtobeliminatebresponsebdecodingbcrashes.
*b**Commitb#12b`[177356a]`**b(*2026-08-27b01:07:08b+0530*):b`fix:bUpdatebGroqbmodelbtobstablebllama3-70b-8192`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+1,b-1blines)
*b**Commitb#13b`[99d913d]`**b(*2026-08-27b01:08:47b+0530*):b`fix:bUpdatebGroqbmodelbtobactivebllama-3.1-70b-versatile`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+1,b-1blines)
bb-b*Fix*:bUpgradedbcontextbwindowbtobhandleblargebarchitecturalbreviewbpayloads.
*b**Commitb#14b`[b1acddb]`**b(*2026-08-27b01:12:53b+0530*):b`fix:bUpdatebGroqbcriticbtobLlamab4bScoutb(allbpreviousbLlamabmodelsbdecommissioned)`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+3,b-3blines)
*b**Commitb#15b`[71a4ccb]`**b(*2026-08-27b01:17:18b+0530*):b`fix:bRevertbGroqbmodelbbackbtobopenai/gpt-oss-120bbperbuserbrequest,bmaintainbfixedbJSONbschemabprompt`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+3,b-3blines)
*b**Commitb#16b`[82b99b4]`**b(*2026-08-27b01:22:13b+0530*):b`fix:bAddbmissingbHTMLbidb'codeBtnText'bthatbwasbcrashingbthebautomatedbself-correctionbloopbsilently`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+2,b-2blines)
bb-b*Fix*:bAddedbmissingbDOMbIDb`codeBtnText`binbUIbtemplate,bpreventingbJavaScriptb`TypeError:bnull`bexceptionsbduringbautomatedbself-correctionbiterations.

---

###b2.4bErab4:bRich-TextbDocuments,bReal-TimebSSEbStreamingb&bMonacobIDEb(BUILDbSYSbv1.3.0.Alpha)
-b**Timeframe**:b2026-08-27b(Morning)
-b**MilestonebVersion**:b`v1.2.0-alpha`btob`v1.3.0-alpha`
-b**Focus**:bRich-TextbDocumentbEditors,bLLMbParsingbEndpoints,bEmbeddedbMonacobIDE,bServer-SentbEventsb(SSE),bTestbCoverage.

####bCommits
*b**Commitb#17b`[58d2828]`**b(*2026-08-27b01:42:26b+0530*):b`feat:bImplementbeditablebYAMLbformattingbforbPhaseb1bRequirementsboutput`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+14,b-3blines)
*b**Commitb#18b`[3b1a3ff]`**b(*2026-08-27b01:43:10b+0530*):b`feat:bImplementbeditablebYAMLbformattingbforbPhaseb2bArchitecturebBlueprintboutput`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+15,b-3blines)
*b**Commitb#19b`[22b9c8a]`**b(*2026-08-27b01:53:21b+0530*):b`feat:bReplacebYAMLbeditorsbwithbhighlybuser-friendlybRichbTextbdocumentbeditors;bAddbLLM-poweredbbackendbparsingbendpoints;bUpdatebREADME`
bb-b*Author*:bAnupambSharmab|b*Files*:b3bfilesb(+99,b-22blines)
bb-b*Implementation*:bReplacedberror-pronebrawbYAMLbtextareasbwithbintuitivebRichbTextbDocumentbEditors;bcreatedbbackendbendpointsb`POSTb/api/parse-requirements`bandb`POSTb/api/parse-design`btobreliablybparsebuser-editedbmarkdownbintobstrictbPydanticbmodels.
*b**Commitb#20b`[cc61090]`**b(*2026-08-27b02:03:27b+0530*):b`fix:bImplementbsafeguardbinbArbitrationbEnginebtobgracefullybhaltbthebautomationbloopbuponbAPIbrateblimitsborbsystemicberrors`
bb-b*Author*:bAnupambSharmab|b*Files*:b3bfilesb(+8,b-7blines)
bb-b*Fix*:bGuardedbLangGraphbAdjudicatorbnodebtobemitb`verdict="error"`binsteadbofb`verdict="revise"`bwhenbcriticsbencounterbAPIbrateblimits,bpreventingbinfinitebbillingbloops.
*b**Commitb#21b`[e613681]`**b(*2026-08-27b02:07:27b+0530*):b`fix:bAlignbrichbtextbformattingbtemplatesbwithbactualbPydanticbschemabfieldbnamesb(user_stories,bfiles,betc.)`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+27,b-4blines)
*b**Commitb#22b`[1980589]`**b(*2026-08-27b02:24:37b+0530*):b`feat:bAddbInteractivebPipelinebStepperbVisualizationbtobfrontendbUI;bUpdatebREADME`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+90,b-4blines)
bb-b*Implementation*:bBuiltb5-phasebhorizontalbprogressbstepperbcomponentbdynamicallybreflectingbactivebexecutionbphases.
*b**Commitb#23b`[faee7da]`**b(*2026-08-27b02:25:29b+0530*):b`feat:bAddbone-clickbDownloadbCodebasbZIPbfunctionalitybusingbJSZip`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+38,b-1blines)
*b**Commitb#24b`[327e44d]`**b(*2026-08-27b02:30:15b+0530*):b`fix:bRestorebmissingbclosingbbracebinbgenerateRequirements()bthatbcausedbabJSbsyntaxberror`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+1bline)
*b**Commitb#25b`[0d2be66]`**b(*2026-08-27b02:38:39b+0530*):b`feat:bImplementbReal-TimebStreamingbOutputb(SSE)bforballbgenerationbphases`
bb-b*Author*:bAnupambSharmab|b*Files*:b6bfilesb(+157,b-69blines)
bb-b*Implementation*:bConvertedballbgenerationbendpointsbtobstreambtoken-by-tokenbusingb`StreamingResponse`,beliminatingbUIblatencybblocking.
*b**Commitb#26b`[60d8ceb]`**b(*2026-08-27b02:42:52b+0530*):b`fix:bRemovebstalebimportsbcausingbImportErrorbinbuvicornbserverbstartup`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/main.py`b(-2blines)
*b**Commitb#27b`[9e6535c]`**b(*2026-08-27b02:49:19b+0530*):b`feat:bImplementbfullybinteractivebEmbeddedbMonacobIDEbinbPhaseb2bbCodeGenboutput`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+101,b-15blines)
bb-b*Implementation*:bEmbeddedbMonacobEditorbintobthebbrowserbUIbwithbmulti-filebtabs,bsyntaxbhighlighting,bandblivebeditingbcapabilities.
*b**Commitb#28b`[38eda2c]`**b(*2026-08-27b03:01:45b+0530*):b`feat:bImplementbglobalbtokenbtrackingbandbcostbcalculationbwidget,bandbupdatebPhasebterminologybtobBUILDbversions`
bb-b*Author*:bAnupambSharmab|b*Files*:b5bfilesb(+81,b-14blines)
bb-b*Implementation*:bInjectedb`\n__USAGE__{prompt},{completion}`bmetadatabintobstreambfooters;bbuiltbreal-timebtokenbandbcostbestimationbwidget.
*b**Commitb#29b`[e0f16a9]`**b(*2026-08-27b03:06:04b+0530*):b`feat:bImplementbTestbCoveragebAnalysisbusingbpytest-covbandbdisplaybmetricsbinbUI`
bb-b*Author*:bAnupambSharmab|b*Files*:b3bfilesb(+21,b-5blines)
bb-b*Implementation*:bAddedb`--cov`bflagbtobpytestbexecutionsbinb`backend/executor.py`bandbrenderedbtestbcoveragebpercentagesbinbthebUI.
*b**Commitb#30b`[1435d50]`**b(*2026-08-27b11:42:50b+0530*):b`fix:bPreventbusagebmetadatabtokenbfrombcorruptingbJSONbstreambmid-flight`
bb-b*Author*:bAnupambSharmab|b*Files*:b3bfilesb(+21,b-9blines)
bb-b*Fix*:bSeparatedbtokenbusagebmetadatabfrombJSONbpayloadbtobpreventb`JSON.parse`bfailuresbduringbstreaming.

---

###b2.5bErab5:bCriticbHardening,bDocumentationbAgentb&bAPIbKeybBalancerb(BUILDbSYSbv1.3.1.Alpha)
-b**Timeframe**:b2026-08-27b(AfternoonbtobNight)
-b**MilestonebVersion**:b`v1.3.1-alpha`
-b**Focus**:bResilientbAPIbkeybpartitioning,b503bfallbackbrouting,bPhaseb3.5bDocumentationbAgent,bandbwhitelistbdefensivebrules.

####bCommits
*b**Commitb#31b`[3cfdbd8]`**b(*2026-08-27b11:46:40b+0530*):b`fix:bAddbfallbackbtobgemini-3.5-flash-litebforbparsingbendpointsbtobhandleb503bUNAVAILABLEberrorsbonbprimarybmodel`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/main.py`b(+38,b-24blines)
*b**Commitb#32b`[071257a]`**b(*2026-08-27b11:49:43b+0530*):b`fix:bCreatebparentbdirectoriesbautomaticallybinbsandboxbexecutorbtobsupportbnestedbfilebgeneration`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/executor.py`b(+1bline)
bb-b*Fix*:bAddedb`os.makedirs(os.path.dirname(path),bexist_ok=True)`bbeforebwritingbfilesbinbsandboxbexecutor.
*b**Commitb#33b`[1f3d2b6]`**b(*2026-08-27b11:52:36b+0530*):b`fix:bStrengthenbtestbdiscoverybbybhandlingbpytestbexitbcodeb5bandbenforcingbpythonbnamingbconventionsbinbdesignbprompts`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+9,b-4blines)
bb-b*Fix*:bHandledbpytestbexitbcodeb5b(nobtestsbcollected)bgracefullybandbreinforcedb`test_*.py`bnamingbrulesbinbdesignbprompts.
*b**Commitb#34b`[5f589c2]`**b(*2026-08-27b12:17:21b+0530*):b`fix:bAddbtypebguardbforbGroq/MistralbAPIsbreturningblistbinsteadbofbdictbinbcriticbresponses`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+10blines)
*b**Commitb#35b`[586e044]`**b(*2026-08-27b12:21:29b+0530*):b`fix:bAddbexplicitbimportbrulebtobCodeGenbpromptbtobpreventbrecurringbNameErrorbonbtypingbconstructs`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/codegen_agent.py`b(+1bline)
*b**Commitb#36b`[f3b0aa1]`**b(*2026-08-27b12:26:13b+0530*):b`fix:bAddbgemini-3.5-flash-litebfallbackbtobCorrectnessbCriticbforb503bUNAVAILABLEberrors`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+10,b-3blines)
*b**Commitb#37b`[f3fea34]`**b(*2026-08-27b12:30:37b+0530*):b`fix:bAddbgemini-3.5-flash-litebfallbackbtobAdjudicatorbforb503bUNAVAILABLEberrors`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/orchestrator.py`b(+14,b-6blines)
*b**Commitb#38b`[5ad0d49]`**b(*2026-08-27b12:43:53b+0530*):b`feat:bImplementbRevisionbHistorybtabsbandbCodebDiffbviewerbtobpreservebandbcomparebself-correctionbloopbiterations`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+231,b-4blines)
*b**Commitb#39b`[bc3a3d4]`**b(*2026-08-27b19:11:00b+0530*):b`fix:bAddbruleb6btobCodeGenbpromptbtobpreventbimportingbbuiltinsbfrombstdlibbmodulesb(e.g.bZeroDivisionErrorbfrombdecimal)`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/codegen_agent.py`b(+1bline)
*b**Commitb#40b`[14dd9ec]`**b(*2026-08-27b20:13:43b+0530*):b`feat:bUsebseparatebGEMINI_API_KEY_ADJUDICATORbforbAdjudicatorbphasebtobbalancebAPIbrateblimits`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/orchestrator.py`b(+1,b-1blines)
bb-b*Implementation*:bPartitionedbAPIbkeybpools:bisolatedbAdjudicatorbonb`GEMINI_API_KEY_ADJUDICATOR`btobavoidbrateblimitbcollisionsbwithbcritics.
*b**Commitb#41b`[48a0596]`**b(*2026-08-27b20:28:49b+0530*):b`feat:bSynchronizebpipelinebtobexplicitlybsupportbandbwhitelistbrobustbedge-casebhandlingb(fixingbinfinitebrevisionbloopsbbetweenbcompletenessbandbarchitecturebcritics)`
bb-b*Author*:bAnupambSharmab|b*Files*:b4bfilesb(+6,b-2blines)
bb-b*Fix*:bInjectedbsystembinstructionsbwhitelistingbdefensivebprogramming,bboundarybchecks,bandbinputbguardsbasbpositivebrobustnessbfeaturesbratherbthanbunapprovedbblueprintbdeviations,bendingbinfinitebcriticbrevisionbping-pongbloops.
*b**Commitb#42b`[3dd7f65]`**b(*2026-08-27b20:56:31b+0530*):b`fix:bProvidebblueprintbtobCompletenessbCriticb(Groq)bandbconstrainbpromptbtobpreventbout-of-scopebfeaturebsuggestions`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+9,b-4blines)
*b**Commitb#43b`[1dd0628]`**b(*2026-08-27b21:13:07b+0530*):b`fix:bMigratebCompletenessbCriticbfrombGroqbtobGeminibtobbypassb8kbTPMblimitsbonbGroqbfreebtierbwhenbpassingbtheblargebblueprintbcontext`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+27,b-46blines)
bb-b*Fix*:bMigratedbCompletenessbCriticbpermanentlybtobGeminib3.6-flash,bbypassingbGroq'sb8,000btokens-per-minutebquotablimit.
*b**Commitb#44b`[0d80e90]`**b(*2026-08-27b21:30:35b+0530*):b`feat:bImplementbPhaseb3.5bDocumentationbAgentbtobautomaticallybgeneratebcomprehensivebREADMEbandbdocumentationbfiles`
bb-b*Author*:bAnupambSharmab|b*Files*:b3bfilesb(+188blines)
bb-b*Implementation*:bCreatedb`backend/agents/documentation_agent.py`b(`DocumentationSet`bmodel)bandbendpointb`POSTb/api/generate-documentation`.
*b**Commitb#45b`[04461e7]`**b(*2026-08-27b21:31:18b+0530*):b`docs:bUpdatebREADMEbwithbBUILDbSYS.v1.3.1.AlphabandbPhaseb3.5bDocumentationbAgent`
bb-b*Author*:bAnupambSharmab|b*Files*:b`README.md`b(+8,b-1blines)
*b**Commitb#46b`[5e1b2dc]`**b(*2026-08-27b21:36:08b+0530*):b`feat:bShowbDocumentationbAgentbonlybafterbarbitrationbcompletesbandbaddbprominentbFinalbDownloadbZIPbbutton`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+16,b-2blines)
*b**Commitb#47b`[bd6ae5c]`**b(*2026-08-27b21:39:28b+0530*):b`fix:bResolvebSyntaxErrorbcausedbbybliteralbbackslashesbinbdocumentationbagentbpromptbstrings`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/documentation_agent.py`b(+5,b-5blines)
*b**Commitb#48b`[4d472f3]`**b(*2026-08-27b23:06:50b+0530*):b`feat:bImplementbAdjudicatorbAPIbKeybasbuniversalbfallbackbforballbCriticbAgentsb(Correctness,bCompleteness,bArchitecture)btobpreventbrateblimits`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+46,b-17blines)
*b**Commitb#49b`[199fd06]`**b(*2026-08-27b23:11:18b+0530*):b`fix:bUpdatebfallbackblogicbtobconditionallybusebadjudicatorbkeybonlybonbrateblimit,belsebuseb3.5-flash-litebonbsamebkey`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/agents/critics.py`b(+59,b-37blines)
bb-b*Implementation*:bEstablishedbdual-axisbfallbackbrouting:bswitchbtob`GEMINI_API_KEY_ADJUDICATOR`bonbHTTPb429bquotabexhaustion;bdowngradebtob`gemini-3.5-flash-lite`bonbthebsamebkeybforbHTTPb503bserverbbusyberrors.

---

###b2.6bErab6:bPolyglotbSDLCb&bUniversalbDockerbSandboxbEnginebv2.0b(BUILDbSYSbv1.4.0.Alphabtobv2.0)
-b**Timeframe**:b2026-08-27b(Night)btob2026-08-28b(Evening)
-b**MilestonebVersion**:b`v1.4.0-alpha`btob`v2.0.0`
-b**Focus**:bPolyglotbtechbstackbsupportb(HTML/JS/Python/React),bdynamicbFastAPIblivebpreviewbendpoints,bDockerizedbexecutionbsandboxbv2.0.

####bCommits
*b**Commitb#50b`[c395cf2]`**b(*2026-08-27b23:36:08b+0530*):b`feat:bImplementbPolyglotbsupportbacrossballbSDLCbphasesb(HTML/JS/Python/etc)bviabdynamicbexecutionbsandboxbandbtechbstackbtracking`
bb-b*Author*:bAnupambSharmab|b*Files*:b8bfilesb(+45,b-30blines)
*b**Commitb#51b`[e5925e4]`**b(*2026-08-27b23:37:08b+0530*):b`docs:bUpdatebREADMEbandbUIbtobbuildbSYS.v1.4.0.AlphabandbdocumentbPolyglotbfeature`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+3,b-2blines)
*b**Commitb#52b`[78717aa]`**b(*2026-08-28b01:29:33b+0530*):b`feat:bImplementbUniversalbTestingbEnginebforballbstacksbandbembedbLivebPreviewbUIbintobMonacobIDE`
bb-b*Author*:bAnupambSharmab|b*Files*:b7bfilesb(+71,b-14blines)
*b**Commitb#53b`[badc58a]`**b(*2026-08-28b11:58:10b+0530*):b`fix:bAuto-injectbdependencybinstallationb(npmbinstallb/bpipbinstall)binbexecutorbsandboxbtobpreventbcommandbnotbfoundberrors`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/executor.py`b(+14,b-1blines)
*b**Commitb#54b`[9730ebd]`**b(*2026-08-28b13:39:41b+0530*):b`fix:bReplacebbrittlebRegexbsrcdocbinjectionbwithbdynamicbFastAPIbLivebPreviewbendpointsbtobfixbES6bmodulebimportsbandb404s`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+68,b-17blines)
*b**Commitb#55b`[08b1693]`**b(*2026-08-28b13:52:38b+0530*):b`feat:bArchitectbv2.0bDockerizedbExecutionbandbPreviewbEnginebtobsecurelybcompilebcomplexbReactbapps`
bb-b*Author*:bAnupambSharmab|b*Files*:b7bfilesb(+180,b-108blines)
bb-b*Implementation*:bCompletelyboverhauledb`backend/executor.py`btobusebDockerbSDKb(`docker.from_env()`).bStreamedbgeneratedbcodebviabin-memorybtarbarchives,bmappedbdynamicbhostbports,bandbenforcedbcontainerbresourcebisolation.
*b**Commitb#56b`[af95e5c]`**b(*2026-08-28b14:01:44b+0530*):b`docs:bUpdatebsetupbinstructionsbforbDockerbv2.0bandbcleanbupboutdatedbprojectbroadmap`
bb-b*Author*:bAnupambSharmab|b*Files*:b`README.md`b(+6,b-8blines)
*b**Commitb#57b`[e3e3d19]`**b(*2026-08-28b14:06:51b+0530*):b`feat:bUpdatebtokenbcostbUIbtobdisplaybinbINRbinsteadbofbUSD`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+6,b-5blines)
*b**Commitb#58b`[4e2ef33]`**b(*2026-08-28b15:10:51b+0530*):b`fix:bUpdatebexecute-codebfetchbpayloadbtobpassbblueprintbinsteadbofbrun_tests_commandbtobresolveb422bPydanticbvalidationberror`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+1,b-1blines)
*b**Commitb#59b`[e91a8f5]`**b(*2026-08-28b16:42:51b+0530*):b`fix:bSanitizebtarballbextractionbpathsbandbpreventbAIbfrombplacingbprojectsbinbrootbsubdirectoriesbtobfixbPythonbmanage.pybErrnob2bbugs`
bb-b*Author*:bAnupambSharmab|b*Files*:b4bfilesb(+15,b-5blines)
*b**Commitb#60b`[647c627]`**b(*2026-08-28b20:57:46b+0530*):b`fix:bUpdatebagentbpromptsbtobstrictlybenforcebpytestbtest_*.pybauto-discoverybnamingbconventionsbtobfixb0bitemsbcollectedberror`
bb-b*Author*:bAnupambSharmab|b*Files*:b2bfilesb(+2,b-2blines)

---

###b2.7bErab7:bComponent-WisebPipelinedbArchitecturebv2.1.0b&bModularbOrchestration
-b**Timeframe**:b2026-08-28b(Night)btob2026-08-29b(EarlybMorning)
-b**MilestonebVersion**:b`v2.1.0`
-b**Focus**:bMasterbArchitectbAgent,bIntegratorbAgent,bComponentbDecompositionbSchema,bMulti-TrackbVisualizerbDashboard.

####bCommits
*b**Commitb#61b`[3fdbde3]`**b(*2026-08-28b21:45:34b+0530*):b`feat:bImplementbComponent-wisebPipelinedbSoftwarebArchitecturingb(v2.1.0)bwithbMasterbArchitectbandbIntegrationbAgents`
bb-b*Author*:bAnupambSharmab|b*Files*:b7bfilesb(+718,b-15blines)
bb-b*Implementation*:bCreatedb`backend/agents/master_architect.py`b(`ComponentDecomposition`bschema)bandb`backend/agents/integrator_agent.py`b(`POSTb/api/integrate`),ballowingbcomplexbprojectsbtobbebdecomposedbintobmodularbcomponents.
*b**Commitb#62b`[112c5bd]`**b(*2026-08-28b23:02:44b+0530*):b`fix(ui):bImplementbinteractive,brobustbcomponentbpipelinebdashboard`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+449,b-276blines)
*b**Commitb#63b`[f62341a]`**b(*2026-08-28b23:10:14b+0530*):b`fix(ui):bResolvebjavascriptbSyntaxErrorbcausedbbybtemplatebliteralsbinbpipelineborchestrator`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+448,b-448blines)
*b**Commitb#64b`[2858161]`**b(*2026-08-28b23:33:20b+0530*):b`fix(ui):bExpandbpagebwidth,bfixbpipelinebconcurrencyboverride,bcorrectlybbindbsource_codebandbcriticbmodels`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+11,b-13blines)
*b**Commitb#65b`[e1240d8]`**b(*2026-08-29b00:14:58b+0530*):b`feat(ui):bAutomatebcodebgenerationbandbarbitrationbloops,bwaitbforbmanualbapprovalbonlybatbfinalbcomponentbvalidation`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+16,b-11blines)
*b**Commitb#66b`[079eada]`**b(*2026-08-29b00:25:10b+0530*):b`fix(ui):bEnforcebtruebstagedbpipelinebconcurrencybandbfixbtextareabrenderingbbugbforbdesignbblueprint`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+70,b-44blines)
*b**Commitb#67b`[3c32b3f]`**b(*2026-08-29b00:32:05b+0530*):b`feat(ui):bRestorebreadablebrich-textbformattingbforbdesignbblueprintbandbwirebupbLLMbparsing`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+31,b-9blines)
*b**Commitb#68b`[15f6e2a]`**b(*2026-08-29b00:52:50b+0530*):b`feat(ui):bRestorebOldbUIbcomponentbaestheticsbandbgridblayoutbinbpipeline`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+189,b-78blines)
*b**Commitb#69b`[56baaec]`**b(*2026-08-29b00:58:49b+0530*):b`fix(ui):bCorrectbDOMbelementbIDsbinbfinalbintegrationbphasebtobmatchbOldbUIbcomponents`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+8,b-4blines)

---

###b2.8bErab8:bMathematicalbDAGbPipelinebEnginebIntegrationb(`backend/autodev_pipeline`)
-b**Timeframe**:b2026-08-29b(Morning)
-b**MilestonebVersion**:b`v2.2.0-DAG`
-b**Focus**:bKahn'sbtopologicalbsort,bTarjan'sbSCCbcyclebdetection,blease-backedb`StageMutex`,batomicb2-phasebhandover,bwrite-aheadbstatebstoreb(WASS).

####bCommits
*b**Commitb#70b`[9166d0a]`**b(*2026-08-29b11:48:43b+0530*):b`feat(pipeline):bIntegratebrobustbmathematicalbpipelinebDAGbalgorithmbintobbackendborchestrator`
bb-b*Author*:bAnupambSharmab|b*Files*:b14bfilesb(+3909,b-39blines)
bb-b*Implementation*:bCreatedb`backend/autodev_pipeline/`bpackageb(`dag_engine.py`,b`concurrency.py`,b`models.py`,b`scheduler.py`,b`fault_tolerance.py`)bandbwiredbintob`backend/pipeline_api.py`.bReplacedbad-hocbpollingbwithbformalbgraph-theoreticbscheduling.
*b**Commitb#71b`[24906a3]`**b(*2026-08-29b12:11:34b+0530*):b`fix(pipeline):bprovidebmissingbrequiredbnamebpositionalbargumentbtobComponentStateRecordbinbAPI`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/pipeline_api.py`b(+4,b-2blines)
bb-b*Fix*:bExtractedb`name=c.get('component_name',bc.get('component_id',b'Unnamed'))`binb`/api/pipeline/init`,bfixingb`TypeError`bonbcomponentbcreation.
*b**Commitb#72b`[69a7443]`**b(*2026-08-29b12:15:55b+0530*):b`fix(ui):bsanitizebunescapedbcontrolbcharactersbinbJSONbstringsbbeforebparsing`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+40,b-1blines)
bb-b*Fix*:bAddedbclient-sidebregexbpre-sanitizationbforbrawbcontrolbcharactersb(`\n`,b`\t`,b`\r`)binbLLMbJSONboutputbstrings.
*b**Commitb#73b`[d805221]`**b(*2026-08-29b12:22:48b+0530*):b`fix(ui):bReleasebDESIGNbstageblockbcorrectlybinbthebDAGbschedulerbafterbapproval`
bb-b*Author*:bAnupambSharmab|b*Files*:b`backend/index.html`b(+1bline)
bb-b*Fix*:bExplicitlybtriggeredb`/api/pipeline/complete`bwithb`stage="DESIGN"`buponbuserbapproval,breleasingbtheb`DESIGN`bstagebmutexbandbunblockingbqueuedbcomponents.
*b**Commitb#74b`[311215c]`**b(*2026-08-29b12:47:23b+0530*):b`fix(pipeline):bIncreasebleasebtimeoutbforbUIbmodebandbpassbMasterbPlanbtobCritics`
bb-b*Author*:bAnupambSharmab|b*Files*:b118bfilesb(+11061,b-14blines)
bb-b*Implementation*:bScaledbdefaultbleasebTTLbfromb30sbtob3600sbinb`models.py`bforbhumanbreview;bpassedb`master_decomposition`bcontextbintobcriticbpromptsbtobpreventbfalse-positivebcriticbrejectionsbonbpartitionedbmicroservices.

---

###b2.9bErab9:bProductionbHardening,bConcurrencybBugbFixesb&bUIbPolishb(HEADb/bv2.2.1-Prod)
-b**Timeframe**:b2026-08-29b(AfternoonbtobEvening)
-b**MilestonebVersion**:b`v2.2.1-Prod`
-b**Focus**:bLivebTerminalbSSEblogbstream,bPromptbGuardbsecuritybfilter,bUIbhorizontalbcarousel,buniversalbexponentialbbackoff.

####bCommits
*b**Commitb#75b`[7b98316]`**b(*2026-08-29b12:56:36b+0530*):b`feat(ui):bimplementblivebterminalblogbpanelbwithbSSEbstreaming`
bb-b*Author*:bAnupambSharmab|b*Files*:b3bfilesb(+152blines)
bb-b*Implementation*:bCreatedb`backend/log_stream.py`b(`LogInterceptor`bwithbSSEbbroadcast)bandbaddedbcollapsibleblivebterminalblogbdrawerbtobfrontendbdashboard.
*b**Commitb#76b`[8c52368]`**b(*2026-08-29b13:06:12b+0530*):b`feat(security):bimplementbInputbValidationbandbPromptbGuard`
bb-b*Author*:bAnupambSharmab|b*Files*:b3bfilesb(+62,b-4blines)
bb-b*Implementation*:bCreatedb`backend/prompt_guard.py`bwithbregexbfiltersbdetectingbpromptbinjectionbattacks,bsystembpromptbextraction,bandbvaguenessbviolations.
*b**Commitb#77b`[84ee7cb]`**b(*2026-08-29b13:14:18b+0530*):b`fix(ui):breworkbpipelinebstepperbforbparallelbDAGbenginebcomponents`
bb-b*Author*:bAnupambSharmab|b*Files*:b8bfilesb(+275,b-19blines)
bb-b*Implementation*:bSynchronizedbUIbhorizontalbstepperbwithbDAGbenginebstates;bexpandedb`backend/retry.py`bwithbasync/generatorbbackoffbsupport.
*b**Commitb#78b`[5502746]`**b(*2026-08-29b18:24:43b+0530*):b`style(ui):brestylebcomponentbpipelinebgridbtobhorizontalbcarouselbwithblightbtheme`
bb-b*Author*:bAnupambSharmab|b*Files*:b5bfilesb(+341,b-39blines)
bb-b*Implementation*:bRestyledbcomponentbpipelinebgridbintobanbelegant,blight-themedbhorizontalbscrollingbcarousel;bexpandedb`backend/retry.py`btob492blinesbwithbpolymorphicbexecutionbsupport,btransientberrorbclassification,bandbfullbjitter.

---

###b2.10bComprehensivebMilestoneb&bVersionbMatrix

|bVersionbTagb|bCommitbHashb|bDateb|bMilestonebScopeb|bCorebArchitecturalbCapabilitiesb|
|---|---|---|---|---|
|b`v0.1.0-alpha`b|b`5e2d61d`b(#02)b|b2026-08-03b|bPhaseb1bRequirementsb|bPydanticbmodelbdefinition,bFastAPIbscaffold,bGeminibAPIbintegrationb|
|b`v0.2.0-alpha`b|b`059979f`b(#05)b|b2026-08-15b|bPhaseb2bSDLCbLoopb|bDesignbBlueprint,bCodeGenbAgent,bSubprocessbexecutionbsandboxb|
|b`v1.0.0-alpha`b|b`afdb38b`b(#07)b|b2026-08-26b|bPhaseb3bArbitrationb|bLangGraphb3-CriticbConsensusbNetwork,bChiefbAdjudicatorbnodeb|
|b`v1.1.0-alpha`b|b`d2d37c2`b(#10)b|b2026-08-27b|bSelf-CorrectionbLoopb|bClosed-loopb3-iterationbself-healingbCodeGenbretrybloopb|
|b`v1.2.0-alpha`b|b`22b9c8a`b(#19)b|b2026-08-27b|bRich-TextbUXb|bRichbtextbdocumentbeditingbwithbGeminibschemabparsingbendpointsb|
|b`v1.3.0-alpha`b|b`9e6535c`b(#27)b|b2026-08-27b|bMonacobIDEb&bSSEb|bMonacobeditorbembed,bSSEbtokenbstreaming,bpytest-covbmetricsb|
|b`v1.3.1-alpha`b|b`0d80e90`b(#44)b|b2026-08-27b|bBalancerb&bDocsb|bPhaseb3.5bDocumentationbAgent,bAdjudicatorbkeybisolationb|
|b`v1.4.0-alpha`b|b`c395cf2`b(#50)b|b2026-08-27b|bPolyglotbSDLCb|bMulti-languagebtechbstackbtracking,bdynamicblivebpreviewb|
|b`v2.0.0`b|b`08b1693`b(#55)b|b2026-08-28b|bDockerbEnginebv2.0b|bIsolatedbDockerbcontainerbexecution,bauto-dependencybinjectionb|
|b`v2.1.0`b|b`3fdbde3`b(#61)b|b2026-08-28b|bComponentbPipelineb|bMasterbArchitect,bIntegrator,bmodularbmulti-componentbpipelineb|
|b`v2.2.0-DAG`b|b`9166d0a`b(#70)b|b2026-08-29b|bMathematicalbDAGb|bKahnbsort,bTarjanbSCC,bStageMutex,b2-phasebhandover,bWASSb|
|b`v2.2.1-Prod`b|b`5502746`b(#78)b|b2026-08-29b|bProductionbReleaseb|bLivebSSEbterminal,bPromptbGuard,bhorizontalbcarouselbUI,bBackoffb|

---

##b3.bDeep-Dive:bCorebAlgorithmb1b—bParallelbComponentbPipelinebSchedulerb&bDAGbEngine

Thebschedulingbenginebisblocatedbinb`backend/autodev_pipeline/`bandbexposedbviab`backend/pipeline_api.py`.

```
+====================================================================================================+
|bbbbbbbbbbbbbbbbbbbbPARALLELbCOMPONENTbPIPELINEbSCHEDULERb(DAGbENGINE)bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
+====================================================================================================+
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+---------------------+bbb+-----------------------+bbb+----------------------------------+bbbbbbbb|
|bb|bbbbbPipelineDAGbbbbb|bbb|bbbStageLockManagerbbbb|bbb|bbbbbbbbStageQueueManagerbbbbbbbbb|bbbbbbbb|
|bb|bKahnbSortb/bTarjanbb|-->|bbLeaseMutexb/bEpochbbb|-->|bMin-Heapb(Scoreb+bFIFObSeq)bbbbbb|bbbbbbbb|
|bb|bbCyclebResolutionbbb|bbb|bbbMutualbExclusionbbbb|bbb|bPrioritybBonusb(-10kbRevision)bbb|bbbbbbbb|
|bb+---------------------+bbb+-----------------------+bbb+----------------------------------+bbbbbbbb|
|bbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+----------------------------------------------------------------------------------------+bbbbbbbb|
|bb|bbbbbbbbbbbbbbPipelineScheduler.step()b/bStageHandoverProtocolb(2-Phase)bbbbbbbbbbbbbbbb|bbbbbbbb|
|bb|bbbbbbbPhaseb1:bReleasebLockb->bPhaseb2:bEnqueuebTargetb(0bHeldbLocksbinbQueue)bbbbbbbbb|bbbbbbbb|
|bb+----------------------------------------------------------------------------------------+bbbbbbbb|
|bbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+-------------------------------------+bbbbbb+-------------------------------------------+bbbbbbbb|
|bb|bMultiTierWatchdogb/bPoisonPillbCBbbb|bbbbbb|bWriteAheadStateStoreb(WASS)b/bRecoverybbbb|bbbbbbbb|
|bb|bDockerb(45s/300s)b|bLeasebTTLbSweepbb|bbbbbb|bSHA-256bEventbJournalb+bAtomicbSnapshotsbb|bbbbbbbb|
|bb+-------------------------------------+bbbbbb+-------------------------------------------+bbbbbbbb|
+====================================================================================================+
```

###b3.1bTheoreticalbMotivationb&bConcurrencybChallenges

Monolithicbexecutionbofbmulti-componentbsoftwarebsuitesbfacesbseverebconcurrencybhazardsbwhenbmultiplebagentsbgenerate,btest,bandbcritiquebcodebasynchronously:
1.b**Hold-and-WaitbCoffmanbDeadlock**:bComponentbinbstageb$S_i$bblocksbwaitingbforbstageb$S_{i+1}$bwhilebrefusingbtobreleasebthebmutexbonb$S_i$.
2.b**StalebStatebCommitb(Split-Brain)**:bAbslowbLLMbcallbcompletesbafterbitsbwatchdogbtimeout,boverwritingbnewlybupdatedbstate.
3.b**QueuebStarvationbofbRevisedbCode**:bFailedbcomponentsbreturnedbforbrevisionbgetbplacedbatbthebtailbofbFIFObqueues,bdelayingboverallbpipelinebcompletion.
4.b**CircularbDependencybLoops**:bComponentsbwithbcircularbdependenciesb($Ab\tobBb\tobA$)bblockbthebpipelinebpermanently.

###b3.2bGraph-TheoreticbFoundationsb&b`PipelineDAG`

Thebdependencybgraphbisbmodeledbasbabdirectedbgraphb$Gb=b(V,bE)$binb`PipelineDAG`b(`backend/autodev_pipeline/dag_engine.py`):
-b**Verticesb($V$)**:bComponentbstatebrecordsb`ComponentStateRecord`.
-b**Edgesb($E$)**:bDependencybedgeb$(u,bv)b\inbE$bdenotesbthatbcomponentb$v$bdependsbonbcomponentb$u$b($ub\tobv$).
-b**DualbAdjacencybIndexing**:
bb-b`_downstream[u]b=b{v1,bv2,b...}`:bSuccessorbsetb($ub\tobv$).
bb-b`_upstream[v]b=b{u1,bu2,b...}`:bPredecessorbsetb($ub\tobv$).

$$\text{deg}^-(v)b=b|\{ub\inbVb\midbub\inb\text{\_upstream}[v]b\landbub\inbV\}|$$

###b3.3bKahn'sbTopologicalbSortb&bLayeredbParallelbScheduling

`PipelineDAG.compute_topological_plan()`bexecutesbKahn'sbAlgorithmb($O(|V|b+b|E|)$)bwithbdeterministicbtie-breakingbbyb`(priority_order,bcomponent_id)`:

1.bIdentifybrootblayerb$L_0b=b\{vb\inbVb\midb\text{deg}^-(v)b=b0\}$.
2.bIncrementallybpeelbexecutionblayersb$L_0,bL_1,b\dots,bL_k$:
bbb$$L_{i+1}b=b\left\{vb\inbVb\setminusb\bigcup_{j=0}^ibL_jb\;\Big|\;b\forallbub\text{bsuchbthatb}b(u,bv)b\inbE,bub\inb\bigcup_{j=0}^ibL_j\right\}$$
3.bComputebcriticalbpathbdistanceb$\text{CP}(u)$bfrombnodeb$u$btobanybsinkbviabreversebtopologicalbdynamicbprogramming:
bbb$$\text{CP}(u)b=b1b+b\max_{(u,bv)b\inbE}b\text{CP}(v)b\quadb(\text{withb}b\text{CP}(\text{sink})b=b1)$$

###b3.4bTarjan'sbStronglybConnectedbComponentsb(SCC)b&bCyclebExtraction

`PipelineDAG.detect_cycles_tarjan()`brunsbTarjan'sbDFSbinb$O(|V|b+b|E|)$btime,bmaintainingbDFSbdiscoverybindicesb`indices[u]`bandblow-linkbvaluesb`lowlinks[u]`:

$$\text{lowlinks}[u]b=b\minb\left(b\text{indices}[u],b\min_{(u,bv)b\inbE,bvb\notinb\text{visited}}b\text{lowlinks}[v],b\min_{(u,bw)b\inbE,bwb\inb\text{stack}}b\text{indices}[w]b\right)$$

AnbSCCbrepresentsbabdirectedbcyclebifb$|\text{SCC}|b>b1$borbifbabnodebcontainsbabself-loopb$(u,bu)b\inbE$.b`_extract_cycle_path_from_scc()`bperformsbDFSbtraversalbwithinbthebSCCbsubgraphbtobextractbthebexactbclosedbcyclebpathb$[u_1,bu_2,b\dots,bu_k,bu_1]$.

###b3.5bDeterministicbCyclebResolutionbPoliciesb(`ABORT`,b`SAFE_STALL`,b`FEEDBACK_ARC_SET_STUB`)

Whenbcyclesbarebdetected,b`PipelineDAG.resolve_cycles()`bappliesbonebofbthreebdeterministicbpolicies:
1.b**`CycleResolutionPolicy.ABORT`**:bImmediatelybabortsbgraphbregistrationbandbreturnsbHTTPb400.
2.b**`CycleResolutionPolicy.SAFE_STALL`**:bIdentifiesballbcyclebparticipantsbandbtheirbtransitivebdownstreambdependents,btransitionsbthembtob`ComponentStatus.STALLED`,bandballowsbindependentbacyclicbsubgraphsbtobproceed.
3.b**`CycleResolutionPolicy.FEEDBACK_ARC_SET_STUB`**:bHeuristicbFeedbackbArcbSetbremovalbthatbiterativelybcutsbcyclebback-edgesb$(u,bv)$bandbinjectsbinterfacebmockbstubsb`stub::{u}_for_{v}`buntilbthebgraphbisbacyclic.

###b3.6bFinitebStatebMachineb&bComponentbAutomatab(`ComponentStatus`)

Everybcomponentbisbgovernedbbybanbimmutablebfinitebstatebautomatonbdefinedbinb`ComponentStatus`b(`backend/autodev_pipeline/models.py`):

```
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb+-----------------------+
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbbbbbCREATEDbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb+-----------------------+
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/bbbbbbbb|bbbbbbbb\
bbbbbbbbbbbbHasbDependenciesbbbb/bbbbbbbbb|bbbbbbbbb\bbbNobDependencies
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbvbbbbbbbbbb|bbbbbbbbbbv
bbbbbbbb+--------------------------+bbbbbb|bbbbbb+--------------------+
bbbbbbbb|bbbbbbbPENDING_DEPSbbbbbbb|bbbbbb|bbbbbb|bbbbbbbREADYbbbbbbbb|<-------------+
bbbbbbbb+--------------------------+bbbbbb|bbbbbb+--------------------+bbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbbbbbbbbbbb|
bbbbbbbbbbPrerequisitesbSatisfiedbbbbbbbbb|bbbbbbbbbStagebAcquiredbbbbbbbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbb+------------------->+bbbbbbbbbbbbbbbbvbbbbbbbbbbbbbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbbb+--------------------+bbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbbb|bbbbbbIN_STAGEbbbbbb|bbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbbb+--------------------+bbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbbbbb/bbbbb|bbbb|bbbbb\bbbbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbStallb/bb|bbbbbbb/bbbbbb|bbbb|bbbbbb\bbCriticbPassbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbFailurebb|bbbbbb/bbbbbbb|bbbb|bbbbbbbvb(NextbStage)b|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbb/bbbbbbbb|bbbb|bbb+-----------+bbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbb/bbbbbbbbb|bbbb+-->|bCOMPLETEDb|bbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbvbbbvbbbbbbbbbb|bbbbbbbb+-----------+bbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb+---------+bbbbbbbbb|bbbbbbbbbbbbbbbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bSTALLEDb|bbbbbbbbb|bCriticbReviseb(<b3)bbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb+---------+bbbbbbbbb+---------------------------+
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbb|bCriticbReviseb(>=b3)b/bPoisonbPill
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbvbbbbbbbbbbbbbbv
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb+--------+bbbb+-------------+
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bFAILEDb|bbbb|bQUARANTINEDb|
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb+--------+bbbb+-------------+
```

####bStatebTransitionbMatrixb(`VALID_TRANSITIONS`)
Statebmutationsbarebvalidatedbbyb`can_transition_to(target)`bandbexecutedbviab`transition_to()`:

|bFrombStateb|bPermittedbTargetbStatesb|bTriggerbConditionb|
|---|---|---|
|b`CREATED`b|b`PENDING_DEPS`,b`READY`,b`STALLED`,b`FAILED`b|bInitialbDAGbregistrationb|
|b`PENDING_DEPS`b|b`READY`,b`STALLED`,b`FAILED`b|bAllbupstreambdependenciesbreachb`COMPLETED`b|
|b`READY`b|b`IN_STAGE`,b`STALLED`,b`FAILED`,b`COMPLETED`b|bMutexbacquiredbonbtargetbstageb|
|b`IN_STAGE`b|b`READY`,b`COMPLETED`,b`QUARANTINED`,b`STALLED`,b`FAILED`b|bStagebfinished,bleasebexpired,borbcriticbverdictb|
|b`STALLED`b|b`READY`,b`PENDING_DEPS`,b`COMPLETED`,b`FAILED`b|bCyclebbrokenborbcascadebpausebliftedb|
|b`QUARANTINED`b|b`READY`,b`COMPLETED`,b`FAILED`b|bCircuitbbreakerbmanualboverrideb|
|b`COMPLETED`b|b*(Noneb-bTerminal)*b|bFinalbsuccessbstateb|
|b`FAILED`b|b*(Noneb-bTerminal)*b|bFinalbunrecoverablebfailureb|

###b3.7bConcurrencybControlb&bMonotonicbEpochbFencingb(`StageMutex`,b`StageLockManager`)

Tobguaranteebstrictbsingleboccupancyb($\leb1$bworkerbperbstage)bandbpreventbsplit-brainbstatebcorruption,b`StageMutex`bandb`StageLockManager`b(`backend/autodev_pipeline/concurrency.py`)bimplementblease-backedblocksbwithbstrictlybmonotonicbepochbfencing:

```python
@dataclass(frozen=True)
classbLeaseToken:
bbbbtoken_id:bstr
bbbbcomponent_id:bstr
bbbbstage:bStageEnum
bbbbepoch:bint
bbbbacquired_at:bfloat
bbbbexpires_at:bfloat
bbbblease_duration_sec:bfloat

bbbbdefbis_valid(self,bcurrent_time:bOptional[float]b=bNone)b->bbool:
bbbbbbbbnowb=btime.time()bifbcurrent_timebisbNonebelsebcurrent_time
bbbbbbbbreturnbnowb<bself.expires_at
```

####bMonotonicbEpochbFencingbProperties:
1.b**StrictbMonotonicity**:bEverybstagebacquisitionborbforcedbevictionbincrementsb`_epoch_counter`:
bbb$$\text{Epoch}_{t+1}b=b\text{Epoch}_tb+b1$$
2.b**StalebCommitbInvalidation**:bWhenbabworkerbfinishesbabstage,bitsbleasebtokenbmustbmatchb`_active_lease.epoch`bandb`_active_lease.token_id`.bIfbabwatchdogbevictedbtheblease,bthebstagebepochbcounterbwasbincremented,bcausingblatebworkerbcommitsbtobbebsafelybrejected.

###b3.8bEliminationbofbCoffman'sbDeadlockbConditionsb&bAtomicb2-PhasebHandover

`StageHandoverProtocol.execute_handover()`bimplementsbabnon-blockingb2-phasebhandoverbthatbprovablybeliminatesbtheb**CoffmanbHold-and-Waitbcondition**:

```
[bWorkerbFinishingbStagebS_ib]
bbbbbbbbbbbbbb│
bbbbbbbbbbbbbb▼
+─────────────────────────────────────────────────────────────────────────+
|bPHASEb1:bUNCONDITIONALbRELEASEbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|b1.block_manager.release_stage(S_i,bcomponent_id,blease_token)bbbbbbbbbbb|
|b2.bClearbcomponent.active_leaseb=bNone,bcomponent.current_stageb=bNonebbb|
|b3.bMutexbonbS_ibbecomesbFREE;bimmediatelybavailablebtobotherbworkersbbb|
+─────────────────────────────────────────────────────────────────────────+
bbbbbbbbbbbbbb│
bbbbbbbbbbbbbb▼
+─────────────────────────────────────────────────────────────────────────+
|bPHASEb2:bTARGETbROUTINGb&bQUEUEbENQUEUEbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bIfbnext_stageb!=bNone:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbcomponent.transition_to(ComponentStatus.READY)bbbbbbbbbbbbbbbbbbbbbbb|
|bbbbqueue_manager.enqueue(next_stage,bcomponent_id,bpriority_order)bbbbbb|
|bElse:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbcomponent.transition_to(ComponentStatus.COMPLETED)bbbbbbbbbbbbbbbbbbb|
+─────────────────────────────────────────────────────────────────────────+
```

####bCoffmanbDeadlockbConditionsbEliminationbMatrix:
1.b**MutualbExclusion**:bStrictlybenforcedbviabsingle-occupancyb`StageMutex`.
2.b**HoldbandbWait**:b**Eliminated**bbybPhaseb1breleasebbeforebPhaseb2bqueuebenqueue.bAbwaitingbcomponentbholdsb**0blocks**.
3.b**NobPreemption**:bPreemptionbisbactivelybsupportedbviabwatchdogbleasebrevocationbwithbepochbbumping.
4.b**CircularbWait**:b**Eliminated**bbybacyclicbDAGbdependenciesbandbmonotonicbstagebprogressionb($\text{DESIGN}b\tob\text{CODEGEN}b\tob\text{CRITICS}$).

###b3.9bPrioritybQueuebMin-HeapbDispatchingb(`StageQueueManager`)

`StageQueueManager`bmanagesbper-stagebmin-heapbprioritybqueuesbusingb`QueueItem`:

```python
@dataclass(order=True)
classbQueueItem:
bbbbpriority_score:bintbbbbbbbbbbbbbb#bPrimarybsortbkeyb(lowerb=bhigherbpriority)
bbbbarrival_sequence:bintbbbbbbbbbbbb#bMonotonicbinsertionbtie-breakerb(FIFO)
bbbbcomponent_id:bstrb=bfield(compare=False)
bbbbenqueued_at:bfloatb=bfield(compare=False,bdefault_factory=time.time)
bbbbmetadata:bDict[str,bAny]b=bfield(compare=False,bdefault_factory=dict)
```

####bPrioritybScoringbFormulation:
$$\text{Score}(c)b=b\text{priority\_order}(c)b-b\begin{cases}b10000b&b\text{ifb}b\text{is\_revision}b=b\text{True}b\\b0b&b\text{otherwise}b\end{cases}$$

-b**RevisionbPrioritybPreemption**:bRevisedbcomponentsbreturningbfromb`CRITICS`breceivebab$-10000$bprioritybscorebbonus,bguaranteeingbtheybjumpbaheadbofbunstartedbcomponentsbtobpreventbpipelinebstalls.
-b**StrictbFIFObTie-Breaking**:bWhenbprioritybscoresbarebidentical,b`arrival_sequence`b(monotonicbcounter)bguaranteesbdeterministicbFIFObdispatching.

###b3.10bDiscretebTickbMechanicsb(`PipelineScheduler.step()`b&b`/api/pipeline/tick`)

`PipelineScheduler.step()`bexecutesbab3-stepbschedulingbcyclebunderb`self._scheduler_lock`:

```
+=============================================================================+
|bbbbbbbbbbbbbbbbbbbbbbSCHEDULINGbTICKbCYCLE:bstep()bbbbbbbbbbbbbbbbbbbbbbbbbb|
+=============================================================================+
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbSTEPb1:bDEPENDENCYbRESOLUTIONb(UnblockbDAGbNodes)bbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb1.bFindbnodesbinbCREATEDborbPENDING_DEPSbwhereballbupstreambinbCOMPLETEDbbb|
|bb2.bTransitionbunblockedbnodes:bCREATED/PENDING_DEPSb->bREADYbbbbbbbbbbbbbb|
|bb3.bEnqueuebunblockedbnodesbintobStageQueueManager[DESIGN]bbbbbbbbbbbbbbbbbb|
|bb4.bLogbDEPENDENCY_RESOLVEDbeventbtobWASSbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbSTEPb2:bEXPIREDbLEASEbWATCHDOGbSWEEPbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb1.block_manager.check_and_clean_expired_leases(now)bbbbbbbbbbbbbbbbbbbbbbbb|
|bb2.bForbeachbexpiredbleaseb(stage,bcid,blease):bbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbb-bForcebrevokebleasebandbincrementbepochbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbb-bTransitionbcomponent:bIN_STAGEb->bREADYb(reason="LEASE_EXPIRED")bbbbb|
|bbbbb-bRe-enqueuebcidbintobStageQueueManager[stage]bbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbb-bLogbSTAGE_LEASE_EXPIREDbeventbtobWASSbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbSTEPb3:bSTAGEbDISPATCHINGb(Highest-PrioritybDequeueb&bLockbAcquisition)bbbb|
|bb1.bForbeachbstagebinb[DESIGN,bCODEGEN,bCRITICS,bINTEGRATION,bDOCS]:bbbbbbbb|
|bbbbb-bCheckbifblock_manager.is_stage_occupied(stage)bisbFalsebbbbbbbbbbbbbbb|
|bbbbb-bPeekbcandidate_idb=bqueue_manager.peek(stage)bbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbb-bIfbcandidate.statusb==bREADY:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbb*bleaseb=block_manager.try_acquire_stage(stage,bcandidate_id)bbbbbbbbb|
|bbbbbbb*bIfbleasebacquired:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbb-bqueue_manager.dequeue(stage)bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbb-bcomp.transition_to(IN_STAGE,bstage=stage,blease=lease)bbbbbbbbbbbb|
|bbbbbbbbb-bLogbSTAGE_LEASE_ACQUIREDbeventbtobWASSbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbb-bAddb(candidate_id,bstage,bepoch)btobdispatchbassignmentsbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
+=============================================================================+
```

###b3.11bFaultbTolerance,bMulti-TierbWatchdogsb&bPoison-PillbIsolation

Locatedbinb`backend/autodev_pipeline/fault_tolerance.py`:

1.b**`MultiTierWatchdog`**:
bbb-b**DockerbTimeoutbGuard**:b`guard_docker_execution(timeout_sec=45.0)`brunsbcontainerbexecutionsbinbabboundedbdaemonbthread,bforciblybterminatingbhungbrunsbwithbexitbcodeb124b(`DOCKER_TIMEOUT_EXCEEDED`).
bbb-b**LLMbTimeoutb&bRetry**:b`execute_with_llm_retry(max_retries=3,binitial_backoff=1.0s)`bimplementsbexponentialbbackoffbwithbjitter,bfast-failingbpermanentberrorsb(`invalid_api_key`,b`schema_violation`).
bbb-b**LeasebTTLbMonitor**:b`monitor_stage_leases()`bcleansbupbstalebleasesbandbresetsbcomponentsbtob`READY`.
2.b**`PoisonPillCircuitBreaker`**:
bbb-bTracksbcumulativebrevisionsbperbcomponent.bWhenb$\text{revision\_count}b\geb3$:
bbbbb-bForciblybreleasesbstagebmutex.
bbbbb-bTransitionsbcomponentbtob`ComponentStatus.QUARANTINED`.
bbbbb-bInvokesb`CascadePauseEngine`btobfreezebdownstreambdependentsbwhilebunaffectedbindependentbcomponentsbcomplete.
3.b**`CascadePauseEngine`**:
bbb-bComputesbtransitivebdownstreambclosure:b$\text{Closure}(u)b=b\{vb\inbVb\midbub\rightsquigarrowbv\}$.
bbb-bTransitionsballbunstartedbdownstreambcomponentsbtob`ComponentStatus.STALLED`bandbremovesbthembfrombstagebprioritybqueues.

###b3.12bWrite-AheadbStatebStoreb(WASS)b&bDeterministicbCrashbRecovery

1.b**Append-OnlybEventbJournalb(`pipeline_events.jsonl`)**:bEverybstatebtransitionblogsbab`StateTransitionEvent`bcontainingbabSHA-256bintegritybhashbwithb`os.fsync()`bdurability.
2.b**AtomicbSnapshotbCheckpointingb(`pipeline_snapshot.json`)**:bCheckpointsbthebcompletebpipelinebstatebatomicallybusingbabtemporarybfilebandbatomicb`os.replace()`.
3.b**DeterministicbCrashbRecoveryb(`CrashRecoveryEngine.recover_pipeline_state()`)**:
bbb-bLoadsblatestbdurablebsnapshot.
bbb-bReplaysbsubsequentbjournalbevents,bverifyingbSHA-256bhashes.
bbb-bRollsbbackballbin-flightbuncommittedb`IN_STAGE`bcomponentsbtob`READY`.
bbb-bReconstructsbprioritybqueuesbbasedbonbexistingbartifactsb(`DESIGN`bifbnobblueprint,b`CODEGEN`bifbblueprintbexists,b`CRITICS`bifbcodebasebexists).

###b3.13bForensicbAnalysisb&bRoot-CausebResolutionbofbConcurrencybHangs

|bIssuebIDb|bAffectedbComponentb|bCommitbHashb/bFileb|bRootbCausebAnalysisb|bTechnicalbFixb&bImplementationb|bSystemicbOutcomeb|
|---|---|---|---|---|---|
|b**BUG-01**b|b`DESIGN`bStagebMutexb|b`d805221`b/b`backend/pipeline_api.py`b|bHumanboperatorsbclickedb'ApprovebBlueprint'binbUI,bbutbbackendbneverbinvokedb`lock_manager.release_stage(DESIGN)`.bMutexbstayedb`HELD`,bpermanentlybblockingbsubsequentbcomponents.b|bExplicitlybinvokedb`scheduler.complete_stage_design()`,breleasingbDESIGNbmutex,bincrementingbepoch,bandbroutingbcomponentbtob`Q_CODEGEN`.b|bEliminatedbDESIGNbstagebpipelinebfreeze;bsubsequentbcomponentsbprogressbimmediately.b|
|b**BUG-02**b|bComponentbInitbAPIb|b`24906a3`b/b`backend/pipeline_api.py`b|b`ComponentStateRecord`brequiredb`name`basbmandatorybpositionalbargument.bInb`/api/pipeline/init`,bthebrouterbinstantiatedbrecordsbomittingb`name`,btriggeringbunhandledb`TypeError`.b|bExtractedb`name=c.get('component_name',bc.get('component_id',b'Unnamed'))`bandbpassedbtob`ComponentStateRecord`.b|bRestoredb100%breliabilitybforb`/api/pipeline/init`bendpoint.b|
|b**BUG-03**b|bUIbJSONbParserb|b`69a7443`b/b`backend/index.html`b|bLLMboutputsbcontainedbunescapedbASCIIbcontrolbcharactersb(literalbnewlinesb`\n`,btabsb`\t`,b`\r`)binbJSONbstrings,bcrashingb`JSON.parse()`.b|bImplementedbregexbpre-sanitization:b`text.replace(/[\x00-\x1F\x7F]/g,bmatchb=>bmatchb===b'\n'b?b'\\n'b:bmatchb===b'\t'b?b'\\t'b:bmatchb===b'\r'b?b'\\r'b:b'')`.b|bPreventedbUIbstatebcorruptionbfrombmalformedbLLMbstringboutputs.b|
|b**BUG-04**b|bWatchdogbLeasebTTLb|b`311215c`b/b`autodev_pipeline/models.py`b|bDefaultbleasebTTLbwasb30.0s.bHumanboperatorsbreviewingbblueprintsbinbUIbtookb>30s,bcausingbwatchdogbtobforciblybevictbactivebleases.b|bIncreasedbdefaultb`lease_duration_sec`bfromb30.0sbtob3600.0sb(1bhour)binb`PipelineConfig`bandb`models.py`.b|bEnabledbhuman-in-the-loopbblueprintbreviewbwithoutbprematurebeviction.b|
|b**BUG-05**b|bCriticbContextbBlindnessb|b`311215c`b/b`backend/agents/critics.py`b|bCriticsbevaluatedbsinglebcomponentbcodebasesbwithoutbunderstandingbmasterbarchitecturebdecomposition,bfalselybflaggingbmissingbfeaturesbpartitionedbinbotherbcomponents.b|bInjectedb`master_decomposition`bcontextbintobcriticbprompts:b*"Thebcurrentbcodebasebisbonlybabsinglebcomponent.bDObNOTbflagbmissingbfunctionalitybbelongingbtobotherbcomponents."*b|bPreventedbfalsebcriticbrejectionsbonbmodularbdistributedbcomponents.b|
|b**BUG-06**b|bPrioritybInversionb|b`backend/autodev_pipeline/concurrency.py`b|bPython'sb`heapq`bisbabmin-heap.bOriginalbformulabusedb`scoreb=b-effective_priority`,binvertingbpriorityborderb(priorityb2bdispatchedbbeforebpriorityb0).b|bFixedbprioritybformulabinb`StageQueueManager.enqueue()`:b`scoreb=bint(priority_order)b-b(10000bifbis_revisionbelseb0)`.b|bEnsuredbhighestbprioritybcomponentsb(priorityb0)bdispatchbstrictlybbeforeblowerbprioritybitems.b|
|b**BUG-07**b|bLeasebInvisibilityb|b`backend/autodev_pipeline/scheduler.py`b|b`scheduler.tick_schedule()`breturnedbonlybnewlybdispatchedbstages.bActivebleasesbheldbacrossbmultiplebticksbreturnedbemptyblists,bcausingbUIbvisualizerbtobshowbcomponentsbasbinactive.b|bAggregatedbbothbactivebstagebleasesbheldbinb`lock_manager`bandbnewlybdispatchedbstages,breturningbcompletebactivebtuplesb`(component_id,bstage,bepoch)`.b|bEnsuredbcontinuous,baccuratebUIbvisualizationbduringbmulti-secondbstagebexecutions.b|
|b**BUG-08**b|bTerminalbLifecycleb|b`backend/autodev_pipeline/scheduler.py`b|bInbsingle-componentbpipelines,bpassingb`CRITICS`broutedbtob`INTEGRATION`,bcausingbcomponentsbtobstallbinb`Q_INTEGRATION`bwithoutbanbintegratorbtrigger.b|bAddedbcheck:b`ifbnorm_stageb==bStageEnum.CRITICS:bnext_stgb=bNone`,btransitioningbcomponentbdirectlybtob`ComponentStatus.COMPLETED`.b|bEnsuredbcleanbcompletionbofbcomponentbexecutionbtracks.b|

---

##b4.bDeep-Dive:bCorebAlgorithmb2b—bSmartbAPIbKeybBalancerbSubsystem

ThebSmartbAPIbKeybBalancerbsubsystembisbimplementedbinb`autodev_balancer/`bandb`backend/retry.py`.

```
+===================================================================================================+
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbAUTODEVbBALANCERbCOMPONENTbTOPOLOGYbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
+===================================================================================================+
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb[bAutoDevbBackendbAgents:bRequirements,bDesign,bCodeGen,bCritics,bAdjudicator,bIntegratorb]bbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+---------------------------------------------------------------------------------------------+bb|
|bb|bbbbbbbbbbbbbbbbbbbAutoDevLLMClientb/bAutoDevBalancerClientbFacadebLayerbbbbbbbbbbbbbbbbbbbbb|bb|
|bb|bbbbbbbbbbb(generate_content,bgenerate_content_stream,bgenerate_gemini_content)bbbbbbbbbbbbbb|bb|
|bb+---------------------------------------------------------------------------------------------+bb|
|bbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbb|
|bbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbb|
|bb+------------------------------+bb+------------------------------+bb+-------------------------+bb|
|bb|bStrictStageReservationGuardbb|bb|bbbbbbbbbModelRouterbbbbbbbbbb|bb|bbTelemetryAggregatorbbbb|bb|
|bb|bMistralb->bCRITIC_ARCHbOnlybb|bb|bStageb->bPrimary/Fallbackbbbb|bb|bbChi-Squareb&bCVbMetricb|bb|
|bb+------------------------------+bb+------------------------------+bb+-------------------------+bb|
|bbbbbbbbbbbbbbbbb\bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+---------------------------------------------------------------------------------------------+bb|
|bb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbFallbackMatrixEnginebbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bb|
|bb|bbbbbbbbbbTierb1:bgemini-3.6-flashb(6bKeys)b->bTierb2:bgemini-3.5-flashb(6bKeys)bbbbbbbbbbbbb|bb|
|bb|bbbbbbbbbbTierb3:bArchitecturebCriticbMistralb->bGeminibPoolbFallbackbbbbbbbbbbbbbbbbbbbbbbbb|bb|
|bb+---------------------------------------------------------------------------------------------+bb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bb+---------------------------------------------------------------------------------------------+bb|
|bb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbKeyPoolManagerbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bb|
|bb|bb+---------------------------------------------------------------------------------------+bb|bb|
|bb|bb|bRoutingStrategy:bLeastConnectionsb(Scoreb=b1000*InFlightb+bTotalReqs),bRR,bWRR,bLRUbb|bb|bb|
|bb|bb|bHealthTracker:bRate-Limitb(ExpbBackoff),bTransientb(5s),bPermanentbDisable,bDecaybbbbb|bb|bb|
|bb|bb|bTokenBucket:bCapacity=60.0,bFillRate=1.0/sbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bb|bb|
|bb|bb+---------------------------------------------------------------------------------------+bb|bb|
|bb+---------------------------------------------------------------------------------------------+bb|
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbb+-------------------------+-------------------------+bbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbbbbbbbbb|
|bbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼bbbbbbbbbbbbbbbbbbbbbb|
|bb+-------------------------------------------+bbb+---------------------------------------------+bb|
|bb|b6xbGeminibAPIbKeysb(GeneralbSDLCbStages)bb|bbb|b1xbMistralbAPIbKeyb(ArchitecturebCritic)bbbb|bb|
|bb|bgemini-3.6-flashb/bgemini-3.5-flashbbbbbbb|bbb|bmistral-small-latestbbbbbbbbbbbbbbbbbbbbbbbb|bb|
|bb+-------------------------------------------+bbb+---------------------------------------------+bb|
+===================================================================================================+
```

###b4.1bArchitecturalbOverviewb&bMulti-PoolbTopology

Thebbalancerbmanagesbtwobdistinctbproviderbpools:
1.b**6bGeminibAPIbKeysb(`ProviderEnum.GEMINI`)**:bSharedbdynamicallybacrossbgeneralbSDLCbstagesb(`REQUIREMENTS`,b`MASTER_ARCHITECT`,b`DESIGN`,b`CODEGEN`,b`CRITIC_CORRECTNESS`,b`CRITIC_COMPLETENESS`,b`ADJUDICATOR`,b`INTEGRATOR`,b`DOCUMENTATION`).
2.b**1bMistralbAPIbKeyb(`ProviderEnum.MISTRAL`)**:bDedicatedbandbstrictlybisolatedbforbthebArchitecturebCriticb(`StageEnum.CRITIC_ARCHITECTURE`).

###b4.2b3-TierbEnvironmentbDiscoverybHierarchy

`KeyDiscovery.discover_gemini_keys()`binb`autodev_balancer/config.py`bresolvesbkeysbacrossbthreebprioritybtiers:
-b**Priorityb1**:b`GEMINI_API_KEYS`b(comma-separated:b`key1,key2,key3,key4,key5,key6`).
-b**Priorityb2**:bNumberedbenvironmentbvariables:b`GEMINI_API_KEY_1`,b`GEMINI_API_KEY_2`,b...,b`GEMINI_API_KEY_6`.
-b**Priorityb3**:bLegacybAutoDevbstagebvariables:b`GEMINI_API_KEY_REQUIREMENTS`,b`GEMINI_API_KEY_DESIGN`,b`GEMINI_API_KEY_CODEGEN`,b`GEMINI_API_KEY_CRITICS`,b`GEMINI_API_KEY_ADJUDICATOR`,b`GEMINI_API_KEY_INTEGRATION`.
-b**SinglebKeybFallback**:b`GEMINI_API_KEY`.
-b**MistralbDiscovery**:b`MISTRAL_API_KEY`b(fallback:b`MISTRAL_KEY`).

###b4.3bStrictbStagebIsolationbGuardb(`StrictStageReservationGuard`)

`StrictStageReservationGuard`b(`autodev_balancer/guard.py`)bcryptographicallybenforcesbthatbthebMistralbkeybisbleasedb**only**bbybthebArchitecturebCritic:

```python
AUTHORIZED_MISTRAL_STAGES:bSet[StageEnum]b=b{
bbbbStageEnum.CRITIC_ARCHITECTURE,
}

AUTHORIZED_MISTRAL_SUBTASKS:bSet[str]b=b{
bbbb"architecture",
bbbb"architecture_critic",
bbbb"arch_critic",
bbbb"evaluate_architecture",
}
```

Anybunauthorizedbstageb(e.g.b`CODEGEN`,b`REQUIREMENTS`,b`ADJUDICATOR`)battemptingbtobacquirebabMistralbkeybimmediatelybraisesb`StageAccessDeniedError`.

###b4.4bDynamicbHealthbTracking,bErrorbClassificationb&bExponentialbCooldownbDecay

`HealthTracker`b(`autodev_balancer/health.py`)bmanagesbdynamicbhealthbstates:
-b`KeyStatus.ACTIVE`:bEligiblebforbimmediatebdispatch.
-b`KeyStatus.COOLDOWN`:bTemporarilybpausedbduebtobtransientberrorb(defaultb5.0s).
-b`KeyStatus.RATE_LIMITED`:bExponentialbcooldownbduebtobHTTPb429bquotabexhaustion.
-b`KeyStatus.DISABLED`:bPermanentlybevictedbduebtobinvalidbAPIbkeyborb401/403bauthberror.

```
bbbbbbbbbbbbbbbbbbbbbb+-------------------+
bbbbbbbbbbbbbbbbbbbbbb|bbbACTIVEb(100%)bbb|<───────────────────────+
bbbbbbbbbbbbbbbbbbbbbb+-------------------+bbbbbbbbbbbbbbbbbbbbbbbb│
bbbbbbbbbbbbbbbbbbbbbbbb/bbbbbbbb│bbbbbbbb\bbbbbbbbbbbbbbbbbbbbbbbb│
bbbbbbbbbbbbbHTTPb429bb/bbbHTTPbb│bbbbbbbbb\bbPermanentbAuthbErrorb│bCooldownbElapsed
bbbbbbbbbbRatebLimitbb/bbbb5xxbbb│bbbbbbbbbb\b(401/403/InvalidKey)b│b(Self-HealingbDecay)
bbbbbbbbbbbbbbbbbbbbbvbbbbbbbbbbbvbbbbbbbbbbbvbbbbbbbbbbbbbbbbbbbbb│
bbbbbbbbbbbbbb+--------------+b+----------+b+--------------+bbbbbbb│
bbbbbbbbbbbbbb|bRATE_LIMITEDb|b|bCOOLDOWNb|b|bbbDISABLEDbbb|bbbbbbb│
bbbbbbbbbbbbbb+--------------+b+----------+b+--------------+bbbbbbb│
bbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbb│bbbbbbbbbbbbb(Fatal)bbbbbbbbb│
bbbbbbbbbbbbbbbbbbbbb│bbbbbbbbbbbbbbb+─────────────────────────────+
bbbbbbbbbbbbbbbbbbbbb+─────────────────────────────────────────────+
```

####bExponentialbRate-LimitbBackoffbFormula:
$$T_{\text{cooldown}}b=b\min\left(T_{\text{max}},bT_{\text{base}}b\cdotb2^{Nb-b1}\right)$$
Whereb$T_{\text{base}}b=b15.0\text{s}$,b$T_{\text{max}}b=b300.0\text{s}$,bandb$Nb=b\text{consecutive\_rate\_limits}$.
-b1stb429bhit:b$15.0\text{s}$
-b2ndb429bhit:b$30.0\text{s}$
-b3rdb429bhit:b$60.0\text{s}$
-b4thb429bhit:b$120.0\text{s}$
-b5thb429bhit:b$240.0\text{s}$
-b6th+b429bhit:b$300.0\text{s}$b(cappedbatb$T_{\text{max}}$)

####bErrorbClassificationbHierarchy:
1.b**RatebLimitb(`is_rate_limit_error`)**:bHTTPb429,b`ResourceExhausted`,b`"rateblimit"`,b`"quota"`.bPlacedbinbexponentialbcooldown.
2.b**TransientbServerbErrorb(`is_transient_server_error`)**:bHTTPb500,b502,b503,b504,b`ConnectionReset`,bsocketbtimeouts.bPlacedbinbbriefb5.0sbcooldown.
3.b**PermanentbAuthbErrorb(`is_permanent_auth_error`)**:bHTTPb401,b403,b`API_KEY_INVALID`,b`PERMISSION_DENIED`.bTransitionsbkeybtob`KeyStatus.DISABLED`.
4.b**PermanentbClientbErrorb(`is_permanent_client_error`)**:bHTTPb400bBadbRequest,b`SchemaViolation`,b`ContextLengthExceeded`.bRecordedbwithoutbpenalizingbhealthybAPIbkeys.

####bMonotonicbSelf-HealingbCooldownbDecay:
`HealthTracker.is_available(key_record,bnow_mono)`bcomparesb`time.monotonic()`bagainstb`key_record.cooldown_until`.bWhenbthebcooldownbperiodbelapses,bthebkeybautomaticallybself-healsbtob`KeyStatus.ACTIVE`bwithoutbbackgroundbpollingbthreads.

###b4.5bPluggablebLoad-BalancingbStrategiesb&bSelectionbAlgorithms

Locatedbinb`autodev_balancer/strategies.py`:

1.b**Least-ConnectionsbStrategyb(`LeastConnectionsStrategy`b-bDefault)**:
bbb$$\text{Score}(k)b=b\alphab\cdotb\text{active\_in\_flight}(k)b+b\betab\cdotb\text{total\_requests}(k)$$
bbbWhereb$\alphab=b1000.0$b(concurrencybpenalty)bandb$\betab=b1.0$b(fairnessbtie-breaker).
2.b**Round-RobinbStrategyb(`RoundRobinStrategy`)**:
bbb$$kb=b\text{candidates}[ib\pmod{|\text{candidates}|}],b\quadbib\leftarrowbib+b1$$
3.b**WeightedbRound-RobinbStrategyb(`WeightedRoundRobinStrategy`)**:bProportionalbdistributionbbasedbonbconfiguredbkeybweights.
4.b**Least-Recently-UsedbStrategyb(`LRUStrategy`)**:
bbb$$k^*b=b\arg\min_{kb\inb\text{candidates}}b\text{last\_used\_timestamp}(k)$$
5.b**TokenbBucketbStrategyb(`TokenBucketStrategy`)**:
bbb-bRateblimitbparameters:bCapacityb$Cb=b60.0\text{btokens}$,bFillbRateb$rb=b1.0\text{btoken/s}$.
bbb-bTokenbrefresh:b$\text{Tokens}_kb\leftarrowb\min(C,b\text{Tokens}_kb+b\Deltabtb\cdotbr)$.
bbb-bFiltersbcandidatesbwhereb$\text{Tokens}_kb\geb1.0$.

###b4.6bMulti-TierbFallbackbMatrixbEngine

`FallbackMatrixEngine`b(`autodev_balancer/fallback.py`)bcoordinatesbmulti-tierbmodelbdegradationbandbkeybrotation:

```
[bRequestbInboundbforbStagebSb]
bbbbbbbbbbbbbbbb│
bbbbbbbbbbbbbbbb▼
bbbbIsbStagebCRITIC_ARCHITECTURE?
bbbbbbbbb/bbbbbbbbbbbbbbbbb\
bbbbbbbYESbbbbbbbbbbbbbbbbbbNO
bbbbbbbb│bbbbbbbbbbbbbbbbbbbb│
bbbbbbbb▼bbbbbbbbbbbbbbbbbbbb▼
bb[bTIERb3:bMISTRALb]bb[bTIERb1:bPRIMARYbGEMINIb(gemini-3.6-flash)b]
bbTrybMistralbKeybbbbbbRotatebacrossbGeminibKeysb1..6bonb429/Transient
bbbbbbbb│bbbbbbbbbbbbbbbbbbbb│
bbbbbSuccess?bbbbbbbbbbbbbbbb│bAllb6bKeysbExhaustedbonb3.6-flash?
bbbbbb/bbb\bbbbbbbbbbbbbbbbbb│
bbbbYESbbbbNOb(Failover)bbbbb▼
bbbbb│bbbbbb+───────────────>[bTIERb2:bSECONDARYbGEMINIb(gemini-3.5-flash)b]
bbbbb│bbbbbbbbbbbbbbbbbbbbbbbRotatebacrossbGeminibKeysb1..6bonb3.5-flash
bbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│
bbbbb│bbbbbbbbbbbbbbbbbbbbbbbAllb6bKeysbExhaustedbonb3.5-flash?
bbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb│
bbbbb│bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb▼
bbbbb│bbbbbbbbbbbbbbbbbbbbbbb[bTOTALbEXHAUSTIONb]
bbbbb│bbbbbbbbbbbbbbbbbbbbbbbRaisebAllKeysExhaustedErrorbwithbTelemetry
bbbbb▼
bb[bReturnbResultb&bTelemetryb]
```

####bFallbackbRules:
1.b**Tierb1b(Intra-TierbKeybRotation)**:bRequestsbattemptb`gemini-3.6-flash`.bOnb429brateblimitborbtransientberror,bthebkeybentersbcooldownbandbthebrequestbretriesbimmediatelybonbthebnextbkeybonbtheb**samebprimarybmodel**.
2.b**Tierb2b(Inter-TierbModelbDegradation)**:bDowngradesbtob`gemini-3.5-flash`b**onlybafterballb6bGeminibkeysbhavebbeenbexhaustedbonbthebprimarybmodel**.
3.b**Tierb3b(Cross-ProviderbCriticbFallback)**:bThebArchitecturebCriticbattemptsbMistralbfirst.bIfbthebMistralbkeybencountersbrateblimits,bitbfallsbbackbseamlesslybtobtheb6-keybGeminibpool.
4.b**Fast-FailbonbPermanentbErrors**:bHTTPb400bBadbRequestborbschemabviolationsbabortbimmediatelybwithoutbburningbsecondarybkeys.

###b4.7bUniversalbExponentialbBackoffbDecoratorb(`backend/retry.py`)

Implementedbinb`backend/retry.py`b(492blines),b`@with_exponential_backoff`bprovidesbabstandalonebdecoratorbforbLLMbAPIbinvocationsbacrossballbbackendbagentbfunctions:

```python
defbwith_exponential_backoff(
bbbbfn:bOptional[Callable]b=bNone,
bbbb*,
bbbbmax_retries:bintb=b3,
bbbbinitial_delay:bfloatb=b1.0,
bbbbbackoff_factor:bfloatb=b2.0,
bbbbjitter:bboolb=bFalse,
bbbbmax_delay:bfloatb=b60.0,
bbbbretryable_exceptions:bOptional[Tuple[Type[Exception],b...]]b=bNone,
bbbbon_retry:bOptional[Callable[[Exception,bint,bfloat],bNone]]b=bNone,
)b->bAny:
```

$$\text{Delay}(\text{attempt})b=b\min\left(\text{max\_delay},b\text{initial\_delay}b\cdotb(\text{backoff\_factor})^{\text{attempt}}\right)b+b\text{jitter}$$
-bAttemptb0:b$1.0\text{s}$bdelay
-bAttemptb1:b$2.0\text{s}$bdelay
-bAttemptb2:b$4.0\text{s}$bdelay

####bPolymorphicbExecutionbSupport:
1.bSynchronousbFunctionsb(`inspect.isfunction`)
2.bSynchronousbGeneratorbFunctionsb(`inspect.isgeneratorfunction`)
3.bSynchronousbStreambIteratorsb(`collections.abc.Iterator`)
4.bAsynchronousbCoroutinesb(`inspect.iscoroutinefunction`)
5.bAsynchronousbGeneratorbStreamsb(`inspect.isasyncgenfunction`)

###b4.8bExhaustionbFailurebModesb&bDiagnosticbTelemetry

Whenballbkeysbacrossballbmodelbtiersbarebexhausted:
1.b`FallbackMatrixEngine`bcapturesbanb`ExecutionTelemetry`brecordbcontainingbfullbdiagnosticbhistorybofbeverybattempt,bprovider,bmodel,blatency,bandberrorbmessage.
2.bComputesbthebminimumbremainingbcooldownbtimebacrossballbkeys:
bbb$$\Deltabt_{\text{min\_recovery}}b=b\min_{kb\inb\text{Keys}}b\max(0,b\text{cooldown\_until}(k)b-bt_{\text{now}})$$
3.bRaisesb`AllKeysExhaustedError`bcontainingbthebtelemetrybandbcooldownbdetails.

###b4.9bStatisticalbTelemetryb&bChi-SquarebFairnessbVerification

`TelemetryAggregator`b(`autodev_balancer/telemetry.py`)bverifiesbloadbdistributionbfairnessbacrossbtheb6bGeminibkeys:

1.b**Pearson'sbChi-SquarebGoodness-of-FitbTest**:
bbb$$\chi^2b=b\sum_{i=1}^{k}b\frac{(O_ib-bE_i)^2}{E_i},b\quadbE_ib=b\frac{N}{k}$$
bbb-bDegreesbofbFreedom:b$\text{df}b=bkb-b1b=b5$.
bbb-bCriticalbvaluebatb$\alphab=b0.05$:b$\chi^2_{\text{crit}}b=b11.070$.
bbb-bPassingbcriterion:b$\chi^2b\leb11.070$b($pb\geb0.05$),bprovingbuniformbdistribution.
2.b**CoefficientbofbVariationb($CV$)**:
bbb$$CVb=b\frac{\sigma}{\mu}b=b\frac{\sqrt{\frac{1}{k}b\sumb(O_ib-b\mu)^2}}{\mu}b\leb0.15$$
3.b**Max-to-MinbAllocationbRatio**:
bbb$$\text{Ratio}b=b\frac{\max(O_i)}{\min(O_i)}b\leb1.30$$
4.b**ZerobStarvationbCheck**:
bbb$$\forallbi,b\quadbO_ib\geb0.70b\cdotb\mu$$

---

##b5.bFullbTechnicalbSpecifications:bBackendbAPIbRoutes

Thebbackendbexposesb**16bdiscretebAPIbroutes**bacrossb`backend/main.py`,b`backend/pipeline_api.py`,bandb`backend/log_stream.py`.

###b5.1bEndpointbCatalogb(16bRoutes)

|b#b|bRoutebURLb|bMethodb|bModuleb|bTagb/bPurposeb|
|---|---|---|---|---|
|b1b|b`/`b|b`GET`b|b`backend/main.py:58`b|bServebSingle-PagebApplicationbClientb(`index.html`)b|
|b2b|b`/api/generate-requirements`b|b`POST`b|b`backend/main.py:68`b|bRequirementsbAgentbStreamingbEndpointb|
|b3b|b`/api/decompose`b|b`POST`b|b`backend/main.py:84`b|bMasterbArchitectbDecompositionbStreamingbEndpointb|
|b4b|b`/api/generate-design`b|b`POST`b|b`backend/main.py:118`b|bSystembDesignbBlueprintbStreamingbEndpointb|
|b5b|b`/api/generate-code`b|b`POST`b|b`backend/main.py:131`b|bCodebGenerationbStreamingbEndpointb|
|b6b|b`/api/parse-requirements`b|b`POST`b|b`backend/main.py:151`b|bRichbTextbtobRequirementsDocumentbJSONbParserb|
|b7b|b`/api/parse-blueprint`b|b`POST`b|b`backend/main.py:182`b|bRichbTextbtobSystemDesignBlueprintbJSONbParserb|
|b8b|b`/api/execute-code`b|b`POST`b|b`backend/main.py:213`b|bDockerbSandboxbTestbExecutionbEndpointb|
|b9b|b`/api/run-critics`b|b`POST`b|b`backend/main.py:221`b|bLangGraphbMulti-CriticbArbitrationbEndpointb|
|b10b|b`/api/integrate`b|b`POST`b|b`backend/main.py:97`b|bMulti-ComponentbIntegratorbStreamingbEndpointb|
|b11b|b`/api/generate-documentation`b|b`POST`b|b`backend/main.py:247`b|bDocumentationbAgentbStreamingbEndpointb|
|b12b|b`/api/preview/start`b|b`POST`b|b`backend/main.py:277`b|bDockerbLivebPreviewbContainerbLaunchbEndpointb|
|b13b|b`/api/pipeline/init`b|b`POST`b|b`backend/pipeline_api.py:25`b|bDAGbGraphb&bPipelinebInitializationbEndpointb|
|b14b|b`/api/pipeline/tick`b|b`GET`b|b`backend/pipeline_api.py:42`b|bDiscretebSchedulingbTickbPollingbEndpointb|
|b15b|b`/api/pipeline/complete`b|b`POST`b|b`backend/pipeline_api.py:54`b|bStagebHandoverb&bCompletionbSignalbEndpointb|
|b16b|b`/api/logs/stream`b|b`GET`b|b`backend/log_stream.py:32`b|bReal-TimebServer-SentbEventsb(SSE)bLogbStreamb|

---

###b5.2bDetailedbRoutebSpecificationsb&bSchemas

####bRouteb1:bServebSingle-PagebApplicationbClient
-b**URL**:b`GETb/`
-b**Source**:b`backend/main.py:58`
-b**Request**:bHeaders:b`Accept:btext/html`b|bBody:bNone
-b**Response**:b`200bOK`b(HTMLbcontentbfromb`backend/index.html`)borb`{"error":b"index.htmlbnotbfound."}`

####bRouteb2:bRequirementsbAgentbStreamingbEndpoint
-b**URL**:b`POSTb/api/generate-requirements`
-b**Source**:b`backend/main.py:68`
-b**RequestbBodyb(`FeatureRequestInput`)**:
bb```json
bb{
bbbb"feature_request":b"Buildbabtaskbmanagerbwithbuserbauthentication,btaskbCRUD,bandbprioritybtagging."
bb}
bb```
-b**Response**:b`200bOK`b(`StreamingResponse`,b`text/plain`).bStreamsb`RequirementsDocument`bJSONbfollowedbbyb`\n__USAGE__{prompt},{completion}`.
-b**ErrorbCodes**:b`400bBadbRequest`b(PromptGuardbsecuritybviolation),b`422bUnprocessablebEntity`,b`500bInternalbServerbError`.

####bRouteb3:bMasterbArchitectbDecompositionbStreamingbEndpoint
-b**URL**:b`POSTb/api/decompose`
-b**Source**:b`backend/main.py:84`
-b**RequestbBodyb(`RequirementsDocument`)**:
bb```json
bb{
bbbb"project_title":b"TaskbManager",
bbbb"overview":b"Taskbmanagementbapplicationbwithbauth.",
bbbb"user_stories":b[]
bb}
bb```
-b**Response**:b`200bOK`b(`StreamingResponse`,b`text/plain`).bStreamsb`ComponentDecomposition`bJSONb+busagebmetadata.
-b**PayloadbStructure**:
bb```json
bb{
bbbb"is_complex":btrue,
bbbb"project_overview":b"Modularbtaskbmanagerbwithbdecoupledbservices.",
bbbb"shared_tech_stack":b["Python",b"FastAPI",b"pytest"],
bbbb"shared_docker_image":b"python:3.11-slim",
bbbb"components":b[
bbbbbb{
bbbbbbbb"component_id":b"auth-service",
bbbbbbbb"component_name":b"AuthenticationbService",
bbbbbbbb"description":b"UserbloginbandbJWTbmanagement.",
bbbbbbbb"scoped_requirements":b"Requirementsbforbauth...",
bbbbbbbb"dependencies_on":b[],
bbbbbbbb"priority_order":b1
bbbbbb},
bbbbbb{
bbbbbbbb"component_id":b"task-service",
bbbbbbbb"component_name":b"TaskbManagementbService",
bbbbbbbb"description":b"CRUDboperationsbforbtasks.",
bbbbbbbb"scoped_requirements":b"Requirementsbforbtasks...",
bbbbbbbb"dependencies_on":b["auth-service"],
bbbbbbbb"priority_order":b2
bbbbbb}
bbbb],
bbbb"integration_strategy":b"Mountbsub-routersbinbmainbFastAPIbapp."
bb}
bb```

####bRouteb4:bSystembDesignbBlueprintbStreamingbEndpoint
-b**URL**:b`POSTb/api/generate-design`
-b**Source**:b`backend/main.py:118`
-b**RequestbBodyb(`DesignInput`)**:
bb```json
bb{
bbbb"requirements":b{
bbbbbb"project_title":b"AuthbService",
bbbbbb"overview":b"Userbauthbmodule.",
bbbbbb"user_stories":b[]
bbbb},
bbbb"component_context":b"TechbStack:bPython,bFastAPI\nDockerbImage:bpython:3.11-slim"
bb}
bb```
-b**Response**:b`200bOK`b(`StreamingResponse`,b`text/plain`).bStreamsb`SystemDesignBlueprint`bJSONb+busagebmetadata.

####bRouteb5:bCodebGenerationbStreamingbEndpoint
-b**URL**:b`POSTb/api/generate-code`
-b**Source**:b`backend/main.py:131`
-b**RequestbBodyb(`CodeGenInput`)**:
bb```json
bb{
bbbb"requirements":b{b"project_title":b"AuthbService",b"overview":b"...",b"user_stories":b[]b},
bbbb"blueprint":b{
bbbbbb"architecture_overview":b"FastAPIbauthbservice",
bbbbbb"tech_stack":b["Python",b"pytest"],
bbbbbb"docker_image":b"python:3.11-slim",
bbbbbb"dev_server_command":b"NONE",
bbbbbb"dev_server_port":b0,
bbbbbb"run_tests_command":b"pytest",
bbbbbb"files":b[
bbbbbbbb{"file_name":b"auth.py",b"purpose":b"JWTbauthblogic",b"dependencies":b["jwt"],b"pseudocode":b"..."},
bbbbbbbb{"file_name":b"test_auth.py",b"purpose":b"Pytestbauthbsuite",b"dependencies":b["pytest"],b"pseudocode":b"..."}
bbbbbb]
bbbb},
bbbb"previous_codebase":bnull,
bbbb"revision_plan":bnull
bb}
bb```
-b**Response**:b`200bOK`b(`StreamingResponse`,b`text/plain`).bStreamsb`GeneratedCodeBase`bJSONb+busagebmetadata.

####bRouteb6:bParsebFree-FormbRequirementsbtobJSON
-b**URL**:b`POSTb/api/parse-requirements`
-b**Source**:b`backend/main.py:151`
-b**RequestbBodyb(`TextUpdateInput`)**:b`{"text":b"PROJECTbTITLE:\nCalculator\n..."}`
-b**Response**:b`200bOK`b(JSONbmatchingb`RequirementsDocument`).

####bRouteb7:bParsebFree-FormbBlueprintbtobJSON
-b**URL**:b`POSTb/api/parse-blueprint`
-b**Source**:b`backend/main.py:182`
-b**RequestbBodyb(`TextUpdateInput`)**:b`{"text":b"ARCHITECTUREbOVERVIEW:\nModularblayout\n..."}`
-b**Response**:b`200bOK`b(JSONbmatchingb`SystemDesignBlueprint`).

####bRouteb8:bDockerbSandboxbTestbExecutionbEndpoint
-b**URL**:b`POSTb/api/execute-code`
-b**Source**:b`backend/main.py:213`
-b**RequestbBodyb(`ExecuteInput`)**:
bb```json
bb{
bbbb"codebase":b{
bbbbbb"files":b[
bbbbbbbb{"file_name":b"app.py",b"source_code":b"defbadd(a,bb):breturnbab+bb\n"},
bbbbbbbb{"file_name":b"test_app.py",b"source_code":b"frombappbimportbadd\ndefbtest_add():bassertbadd(2,b3)b==b5\n"}
bbbbbb]
bbbb},
bbbb"blueprint":b{
bbbbbb"architecture_overview":b"Calculator",
bbbbbb"tech_stack":b["Python",b"pytest"],
bbbbbb"docker_image":b"python:3.11-slim",
bbbbbb"dev_server_command":b"NONE",
bbbbbb"dev_server_port":b0,
bbbbbb"run_tests_command":b"pytest",
bbbbbb"files":b[]
bbbb}
bb}
bb```
-b**Response**:b`200bOK`b(`ExecutionResult`):
bb```json
bb{
bbbb"success":btrue,
bbbb"logs":b"=============================btestbsessionbstartsb=============================\nplatformblinuxb--bPythonb3.11.9\nrootdir:b/workspace\ncollectedb1bitem\n\ntest_app.pyb.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb[100%]\n\n==============================b1bpassedbinb0.02sb==============================\nTOTALb2b0b100%"
bb}
bb```

####bRouteb9:bMulti-CriticbArbitrationb&bAdjudicationbEndpoint
-b**URL**:b`POSTb/api/run-critics`
-b**Source**:b`backend/main.py:221`
-b**RequestbBodyb(`ArbitrationInput`)**:
bb```json
bb{
bbbb"requirements":b{b"project_title":b"Auth",b"overview":b"...",b"user_stories":b[]b},
bbbb"blueprint":b{b"architecture_overview":b"...",b"tech_stack":b[],b"docker_image":b"python:3.11-slim",b"dev_server_command":b"NONE",b"dev_server_port":b0,b"run_tests_command":b"pytest",b"files":b[]b},
bbbb"codebase":b{b"files":b[b{b"file_name":b"auth.py",b"source_code":b"..."b}b]b},
bbbb"execution_result":b{b"success":btrue,b"logs":b"1bpassedbinb0.02s"b},
bbbb"master_decomposition":bnull
bb}
bb```
-b**Response**:b`200bOK`:
bb```json
bb{
bbbb"feedbacks":b[
bbbbbb{
bbbbbbbb"critic_name":b"CorrectnessbCriticb(Gemini)",
bbbbbbbb"severity_score":b0,
bbbbbbbb"issues_list":b[],
bbbbbbbb"overall_comments":b"Allbtestsbpassedbcleanly."
bbbbbb},
bbbbbb{
bbbbbbbb"critic_name":b"ArchitecturebCriticb(Mistral)",
bbbbbbbb"severity_score":b0,
bbbbbbbb"issues_list":b[],
bbbbbbbb"overall_comments":b"Compliesbwithbblueprint."
bbbbbb},
bbbbbb{
bbbbbbbb"critic_name":b"CompletenessbCriticb(Gemini)",
bbbbbbbb"severity_score":b0,
bbbbbbbb"issues_list":b[],
bbbbbbbb"overall_comments":b"Edgebcasesbguarded."
bbbbbb}
bbbb],
bbbb"decision":b{
bbbbbb"verdict":b"pass",
bbbbbb"revision_plan":b"Codebasebverifiedbandbapproved."
bbbb}
bb}
bb```

####bRouteb10:bMulti-ComponentbIntegratorbStreamingbEndpoint
-b**URL**:b`POSTb/api/integrate`
-b**Source**:b`backend/main.py:97`
-b**RequestbBodyb(`IntegrationInput`)**:
bb```json
bb{
bbbb"requirements":b{b"project_title":b"TaskbApp",b"overview":b"...",b"user_stories":b[]b},
bbbb"decomposition":b{b"is_complex":btrue,b"project_overview":b"...",b"shared_tech_stack":b["Python"],b"shared_docker_image":b"python:3.11-slim",b"components":b[],b"integration_strategy":b"Importbsubmodules"b},
bbbb"component_results":b[
bbbbbb{
bbbbbbbb"component_id":b"auth-service",
bbbbbbbb"component_name":b"Auth",
bbbbbbbb"blueprint":b{b"architecture_overview":b"...",b"tech_stack":b[],b"docker_image":b"...",b"dev_server_command":b"...",b"dev_server_port":b0,b"run_tests_command":b"pytest",b"files":b[]b},
bbbbbbbb"codebase":b{b"files":b[b{b"file_name":b"auth.py",b"source_code":b"..."b}b]b},
bbbbbbbb"execution_result":b{b"success":btrue,b"logs":b"..."b}
bbbbbb}
bbbb]
bb}
bb```
-b**Response**:b`200bOK`b(`StreamingResponse`,b`text/plain`).bStreamsbmergedb`GeneratedCodeBase`bJSONb+busagebmetadata.

####bRouteb11:bDocumentationbAgentbStreamingbEndpoint
-b**URL**:b`POSTb/api/generate-documentation`
-b**Source**:b`backend/main.py:247`
-b**RequestbBodyb(`DocumentationInput`)**:
bb```json
bb{
bbbb"requirements":b{b"project_title":b"TaskbApp",b"overview":b"...",b"user_stories":b[]b},
bbbb"blueprint":b{b"architecture_overview":b"...",b"tech_stack":b[],b"docker_image":b"...",b"dev_server_command":b"...",b"dev_server_port":b0,b"run_tests_command":b"pytest",b"files":b[]b},
bbbb"codebase":b{b"files":b[b{b"file_name":b"main.py",b"source_code":b"..."b}b]b}
bb}
bb```
-b**Response**:b`200bOK`b(`StreamingResponse`,b`text/plain`).bStreamsb`DocumentationSet`bJSONb(`README.md`,b`USER_GUIDE.md`)b+busagebmetadata.

####bRouteb12:bDockerbLivebPreviewbContainerbLaunchbEndpoint
-b**URL**:b`POSTb/api/preview/start`
-b**Source**:b`backend/main.py:277`
-b**RequestbBodyb(`ExecuteInput`)**:bCompletebcodebasebandbblueprintbwithbdevbserverbcommand.
-b**Response**:b`200bOK`b(`{"url":b"http://localhost:<dynamic_port>"}`).

####bRouteb13:bDAGbGraphb&bPipelinebInitializationbEndpoint
-b**URL**:b`POSTb/api/pipeline/init`
-b**Source**:b`backend/pipeline_api.py:25`
-b**RequestbBodyb(`PipelineInitInput`)**:
bb```json
bb{
bbbb"components":b[
bbbbbb{
bbbbbbbb"component_id":b"auth-service",
bbbbbbbb"name":b"AuthbService",
bbbbbbbb"dependencies_on":b[],
bbbbbbbb"priority_order":b1
bbbbbb},
bbbbbb{
bbbbbbbb"component_id":b"task-service",
bbbbbbbb"name":b"TaskbService",
bbbbbbbb"dependencies_on":b["auth-service"],
bbbbbbbb"priority_order":b2
bbbbbb}
bbbb]
bb}
bb```
-b**Response**:b`200bOK`b(`{"status":b"ok"}`)borb`400bBadbRequest`b(`{"detail":b"Cyclicbdependenciesbdetectedbinbcomponents"}`).

####bRouteb14:bDiscretebSchedulingbTickbPollingbEndpoint
-b**URL**:b`GETb/api/pipeline/tick`
-b**Source**:b`backend/pipeline_api.py:42`
-b**Request**:bNone
-b**Response**:b`200bOK`:
bb```json
bb{
bbbb"assignments":b[
bbbbbb{
bbbbbbbb"component_id":b"auth-service",
bbbbbbbb"stage":b"DESIGN",
bbbbbbbb"epoch":b1
bbbbbb}
bbbb]
bb}
bb```

####bRouteb15:bStagebHandoverb&bCompletionbSignalbEndpoint
-b**URL**:b`POSTb/api/pipeline/complete`
-b**Source**:b`backend/pipeline_api.py:54`
-b**RequestbBodyb(`CompleteStageInput`)**:
bb```json
bb{
bbbb"component_id":b"auth-service",
bbbb"stage":b"DESIGN",
bbbb"verdict":b"pass"
bb}
bb```
-b**Response**:b`200bOK`b(`{"success":btrue}`).

####bRouteb16:bReal-TimebServer-SentbEventsb(SSE)bLogbStream
-b**URL**:b`GETb/api/logs/stream`
-b**Source**:b`backend/log_stream.py:32`
-b**RequestbHeaders**:b`Accept:btext/event-stream`
-b**Response**:b`200bOK`b(`StreamingResponse`,b`text/event-stream`).bEmitsbrawblogbstreambitemsbandbperiodicb`:bkeepalive`bcomments.

---

###b5.3bPydanticbDomainbModelsbReference

```
+====================================================================================================+
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbPYDANTICbDOMAINbMODELSbREFERENCEbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
+====================================================================================================+
|bModelbClassbbbbbbbbbbbb|bSourcebLocationbbbbbbbbbbbbbbb|bKeybFieldsb&bDescriptionsbbbbbbbbbbbbbbbbb|
+------------------------+-------------------------------+-------------------------------------------+
|bFeatureRequestInputbbbb|bbackend/main.py:25bbbbbbbbbbbb|bfeature_requestb(str)bbbbbbbbbbbbbbbbbbbbb|
|bTextUpdateInputbbbbbbbb|bbackend/main.py:28bbbbbbbbbbbb|btextb(str)bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bCodeGenInputbbbbbbbbbbb|bbackend/main.py:31bbbbbbbbbbbb|brequirements,bblueprint,bprevious,bplanbbb|
|bDocumentationInputbbbbb|bbackend/main.py:37bbbbbbbbbbbb|brequirements,bblueprint,bcodebasebbbbbbbbb|
|bExecuteInputbbbbbbbbbbb|bbackend/main.py:42bbbbbbbbbbbb|bcodebaseb(GeneratedCodeBase),bblueprintbbb|
|bArbitrationInputbbbbbbb|bbackend/main.py:46bbbbbbbbbbbb|breqs,bblueprint,bcodebase,bexec_res,bdecomp|
|bIntegrationInputbbbbbbb|bbackend/main.py:53bbbbbbbbbbbb|brequirements,bdecomposition,bcomp_resultsb|
|bDesignInputbbbbbbbbbbbb|bbackend/main.py:114bbbbbbbbbbb|brequirements,bcomponent_contextbbbbbbbbbbb|
|bPipelineInitInputbbbbbb|bbackend/pipeline_api.py:17bbbb|bcomponentsb(List[Dict[str,bAny]])bbbbbbbbb|
|bCompleteStageInputbbbbb|bbackend/pipeline_api.py:20bbbb|bcomponent_id,bstage,bverdictbbbbbbbbbbbbbb|
|bAcceptanceCriteriabbbbb|bbackend/models.py:6bbbbbbbbbbb|bid,bdescription,bexpected_behaviorbbbbbbbb|
|bUserStorybbbbbbbbbbbbbb|bbackend/models.py:12bbbbbbbbbb|btitle,bas_a,bi_want_to,bso_that,bcriteriab|
|bRequirementsDocumentbbb|bbackend/models.py:20bbbbbbbbbb|bproject_title,boverview,buser_storiesbbbbb|
|bFileBlueprintbbbbbbbbbb|bbackend/models.py:28bbbbbbbbbb|bfile_name,bpurpose,bdeps,bpseudocodebbbbbb|
|bSystemDesignBlueprintbb|bbackend/models.py:35bbbbbbbbbb|barch_overview,btech_stack,bdocker_image,bb|
|bbbbbbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bdev_server_cmd,brun_tests_cmd,bfilesbbbbbb|
|bCodeFilebbbbbbbbbbbbbbb|bbackend/models.py:47bbbbbbbbbb|bfile_name,bsource_codebbbbbbbbbbbbbbbbbbbb|
|bGeneratedCodeBasebbbbbb|bbackend/models.py:52bbbbbbbbbb|bfilesb(List[CodeFile])bbbbbbbbbbbbbbbbbbbb|
|bExecutionResultbbbbbbbb|bbackend/models.py:56bbbbbbbbbb|bsuccessb(bool),blogsb(str)bbbbbbbbbbbbbbbb|
|bCriticFeedbackbbbbbbbbb|bbackend/models.py:63bbbbbbbbbb|bcritic_name,bseverity_score,bissues,bcomms|
|bAdjudicatorDecisionbbbb|bbackend/models.py:72bbbbbbbbbb|bverdictb(pass/revise/error),brevision_plan|
|bComponentSpecbbbbbbbbbb|bbackend/models.py:79bbbbbbbbbb|bcomponent_id,bname,bdesc,bscoped_reqs,bbbb|
|bbbbbbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bdependencies_on,bpriority_orderbbbbbbbbbbb|
|bComponentDecompositionb|bbackend/models.py:88bbbbbbbbbb|bis_complex,bproject_overview,btech_stack,bb|
|bbbbbbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bdocker_image,bcomponents,binteg_strategybb|
|bComponentResultbbbbbbbb|bbackend/models.py:97bbbbbbbbbb|bcomponent_id,bname,bblueprint,bcodebase,bb|
|bbbbbbbbbbbbbbbbbbbbbbbb|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|bexecution_resultbbbbbbbbbbbbbbbbbbbbbbbbbb|
|bDocumentationSetbbbbbbb|bdocumentation_agent.py:13bbbbb|bfilesb(List[CodeFile])bbbbbbbbbbbbbbbbbbbb|
+====================================================================================================+
```

---

##b6.bFullbTechnicalbSpecifications:bFrontendbUIbArchitectureb&bLogic

Thebclientbdashboardbisbimplementedbinb`backend/index.html`basbabzero-buildbSingle-PagebApplicationbutilizingbTailwindbCSS,bMonacobEditor,bandbServer-SentbEvents.

###b6.1bClientbComponentbHierarchyb&bLayoutbStructure

```
+-----------------------------------------------------------------------------------------+
|b[Header]bTitle:bAutoDevbAutonomousbSDLCb|bGlobalbCostbTrackerb(INRb/bTokenbCounter)bbbbb|
+-----------------------------------------------------------------------------------------+
|b[PipelinebProgressbStepper]b(1.bReqb->b2.bDecompb->b3.bDesignb->b4.bCodeb->b5.bIntegr)bb|
+-----------------------------------------------------------------------------------------+
|b[InputbSection]bFeaturebRequestbTextareab+bSYS.REQ_COMPILERbExecutionbButtonbbbbbbbbbbbb|
+-----------------------------------------------------------------------------------------+
|b[ErrorbBanner]b(Hiddenbbybdefault;bdisplaysbPromptGuardb&bAPIbfailurebalerts)bbbbbbbbbbb|
+-----------------------------------------------------------------------------------------+
|b[Phaseb1bOutput]bRichbTextbEditablebRequirementsbDocumentb+bSYS.DECOMPOSERbTriggerbbbbbb|
+-----------------------------------------------------------------------------------------+
|b[Phaseb1.5bDecomposition]bComponentbBreakdownbCardsb+bLaunchbPipelinebTriggerbbbbbbbbbb|
+-----------------------------------------------------------------------------------------+
|b[ComponentbPipelinebDashboard]bHorizontallybScrollingbMulti-TrackbCarouselbCards:bbbbbb|
|b+-------------------------------------------------------------------------------------+b|
|b|bComponentbCard:bID,bName,bStatusbBadgebbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|b|
|b|b-bSub-Panelb1:bArchitecturalbBlueprintb(EditablebTextareab+bApprovebButton)bbbbbbbbb|b|
|b|b-bSub-Panelb2:bGeneratedbCodebaseb(MonacobEditorb+bFilebExplorerb+bRevisionbTabs)bbb|b|
|b|b-bSub-Panelb3:bArbitrationbFeedbackb(ExecutionbLogsb+bCriticbCardsb+bAdjudicator)bbb|b|
|b|b-bComponentbLockbButton:bApprovesbandbmovesbcomponentbtobpassingbbufferbbbbbbbbbbbbb|b|
|b+-------------------------------------------------------------------------------------+b|
|b[IntegrationbSection]bTriggeredbonceballbcomponentsbpassb->bMergedbCodebaseb&bTestsbbbb|
+-----------------------------------------------------------------------------------------+
|b[Single-PassbOutputbSections]b(Forbnon-complexbprojects):bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
|b-bPhaseb2bDesignb->bPhaseb2bbCodeGenb&bLivebDockerbPreviewb->bPhaseb2cbSandboxbTestsbbb|
|b-bPhaseb3bCriticsb->bPhaseb3.5bDocumentationbGenerationb&bDownloadb.ZIPbbbbbbbbbbbbbbb|
+-----------------------------------------------------------------------------------------+
|b[CollapsiblebLivebTerminalbDrawer]bReal-timebSSEb/api/logs/streambconsoleboutputbbbbbbbb|
+-----------------------------------------------------------------------------------------+
```

###b6.2bFrontendbStatebMachineb&bStagebProgressionbAutomata

```
[queued]
bbb│
bbb▼b(DispatchedbtobDESIGNbstagebbyb/api/pipeline/tick)
[designing]b(Streamingbblueprintbfromb/api/generate-design)
bbb│
bbb▼
[waiting_design]b(Promptingboperatorbtobinspect/editbrichbtextbblueprint)
bbb│
bbb▼b(Operatorbclicksb"ApprovebDesignb&bGeneratebCode"b->b/api/pipeline/complete[DESIGN])
[coding_queued]
bbb│
bbb▼b(DispatchedbtobCODEGENbstagebbyb/api/pipeline/tick)
[coding]b(Streamingbsourcebfilesbfromb/api/generate-codebintobMonaco)
bbb│
bbb▼b(Completedb->b/api/pipeline/complete[CODEGEN])
[critic_queued]
bbb│
bbb▼b(DispatchedbtobCRITICSbstagebbyb/api/pipeline/tick)
[executing]b(RunningbtestbsuitebinbDockerbcontainerbviab/api/execute-code)
bbb│
bbb▼
[critiquing]b(Invokingbparallelbarbitrationbcriticsbviab/api/run-critics)
bbb│
bbb├─►bIfbverdictb==b'revise'b&&brevisionCountb<b3:
bbb│bbbbbbIncrementbrevisionCountb->b[coding_queued]b(Autonomousbself-correction)
bbb│
bbb├─►bIfbverdictb==b'pass':
bbb│bbbbbb[waiting_critic]b->bOperatorbclicksb"LockbFinalbComponent"
bbb│bbbbbb->b[passed]b(Componentblocked,b/api/pipeline/complete[CRITICS])
bbb│
bbb└─►bIfbverdictb==b'fail'borbrevisionCountb>=b3:
bbbbbbbbbb[failed]b/bMaxbRevisionsb(Manualbinspectbandbforcebapproveboption)
```

####bFrontendbStatebVisualbIndicatorbReference:

|bStatebStringb|bVisualbBadgebStylingb|bStatusbLabelb|
|---|---|---|
|b`queued`b|b`bg-slate-800btext-slate-400bborderbborder-slate-700`b|bQueuedbforbDesignb|
|b`designing`b|b`bg-indigo-500/20btext-indigo-400bborderbborder-indigo-500/30`b|bDesigning...b|
|b`waiting_design`b|b`bg-yellow-500/20btext-yellow-400bborderbborder-yellow-500/30banimate-pulse`b|bActionbRequiredb|
|b`coding_queued`b|b`bg-slate-800btext-slate-400bborderbborder-slate-700`b|bQueuedbforbCodeb|
|b`coding`b|b`bg-purple-500/20btext-purple-400bborderbborder-purple-500/30`b|bCoding...b|
|b`critic_queued`b|b`bg-slate-800btext-slate-400bborderbborder-slate-700`b|bQueuedbforbTestsb|
|b`executing`b/b`critiquing`b|b`bg-rose-500/20btext-rose-400bborderbborder-rose-500/30`b|bEvaluating...b|
|b`waiting_critic`b|b`bg-yellow-500/20btext-yellow-400bborderbborder-yellow-500/30banimate-pulse`b|bActionbRequiredb|
|b`passed`b|b`bg-emerald-500/20btext-emerald-400bborderbborder-emerald-500/30`b|bPassedb✓b|
|b`failed`b|b`bg-red-500/20btext-red-400bborderbborder-red-500/30`b|bFailedb✗b|

###b6.3bPollingbLoop,bSSEbLogbStreamb&bEventbHandling

1.b**TickbPollingbLoopb(`setInterval(processPipeline,b2000)`)**:
bbb-bRunsbeveryb**2,000bmilliseconds**.
bbb-bInvokesb`GETb/api/pipeline/tick`btobreceivebthebactiveb`assignments`barray.
bbb-bTriggersbmatchingbstagebhandlersb(`startComponentDesign`,b`startComponentCoding`,b`startComponentCritic`).
2.b**AtomicbStagebCompletionbDispatch**:
bbb-bDispatchesb`POSTb/api/pipeline/complete`bwithbpayloadb`{"component_id":bcId,b"stage":b"<STAGE>",b"verdict":b"pass"}`.
3.b**SSEbLivebTerminalbStream**:
bbb-bInitializesb`newbEventSource('/api/logs/stream')`bonbDOMbload.
bbb-bHighlightsblogblinesbdynamicallyb(cyanbforbagents,bgreenbforbpasses,bredbforberrors,byellowbforbwarnings).
4.b**TokenbUsageb&bINRbCostbConversion**:
bbb-bIngestsb`\n__USAGE__{prompt},{completion}`bfootersbandbcomputesbcostbusingbabmultiplierbofb84bINR/USD.
5.b**StreambSanitizationb&bControlbCharacterbParsing**:
bbb-bSanitizesbstreamingbLLMboutputbinb`readJsonStream()`btobescapebcontrolbcharactersbbeforebinvokingb`JSON.parse()`.

###b6.4bEmbeddedbMonacobEditor,bLivebDockerbPreviewb&bSecuritybControls

1.b**MonacobEditorbIntegration**:bInjectsbfullbVSbCodebeditingbcorebwithbtabs,bsyntaxbhighlighting,bandbbufferbsynchronizationbbeforebexecution.
2.b**DynamicbDockerbPreviewbSandbox**:bStartsbabDockerbcontainerbwithblivebportbmapping,bdisplayingbwebbappsbinbanbinteractivebiframe.
3.b**PromptbGuardbSecuritybCheck**:bValidatesbinputblengthb($\geb10$bchars),bwordbcountb($\geb3$bwords),bandbfiltersbpromptbinjectionbtokens.
4.b**Re-entrancybProtection**:bDisablesbbuttonsbandbshowsbspinnersbimmediatelybuponbclick.
5.b**Self-Correctionb3-CyclebCap**:bAutomaticallybcapsbself-correctionbcyclesbatb3biterationsbtobpreventbinfinitebtokenbconsumption.

---

##b7.bVerificationb&bTestbSuitebDocumentation

AutoDevbincludesbanbexhaustivebtestbsuitebcoveringbunitbcontracts,bend-to-endbpipelinebflows,badversarialbDAGbstressbscenarios,bandbdecoratorbresilience.

```
+====================================================================================================+
|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbAUTODEVbVERIFICATIONbMATRIXbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|
+====================================================================================================+
|bTestbSuitebFilebbbbbbbbbbbbbbbbbbbb|bTestbFocusb&bScopebbbbbbbbbbbbbbbbbbbbbbbb|bTestbCountb&bModeb|
+------------------------------------+-------------------------------------------+-------------------+
|btest_pipeline_flow.pybbbbbbbbbbbbbb|b4bIntegrationbTiersb+bSubsystembContractsb|b13bTestbCasesbbbbb|
|btest_pipeline_stress_challenge.pybb|b5bAdversarialbConcurrencybChallengesbbbbbb|b5bStressbCasesbbbb|
|btest_backoff.pybbbbbbbbbbbbbbbbbbbb|bExponentialbBackoffb&bFallbackbMatrixbbbbb|b24bUnitbCasesbbbbb|
+====================================================================================================+
```

###b7.1bAutomatedbIntegrationbSuiteb(`test_pipeline_flow.py`)

`test_pipeline_flow.py`bverifiesbthebcompleteblifecyclebacrossb4bformalbtestingbtiers:

1.b**Tierb1:bSinglebComponentbFullbLifecycle**:
bbb-b`test_tier1_single_component_full_lifecycle`:bPushesbabsinglebcomponentbfromb`CREATED`bthroughb`DESIGN`,b`CODEGEN`,bandb`CRITICS`btob`COMPLETED`.
2.b**Tierb2:bBoundaryb&bCornerbCases**:
bbb-b`test_tier2_cyclic_dag_rejection`:bConfirmsbimmediatebHTTPb400brejectionbofbcyclicbdependencybgraphs.
bbb-b`test_tier2_empty_components_init`:bVerifiesbemptybdecompositionbhandling.
bbb-b`test_tier2_idle_ticks_no_active_components`:bAssertsbemptybassignmentbarraysbonbidlebticks.
bbb-b`test_tier2_stale_stage_completion`:bVerifiesbrejectionbofbduplicateborbout-of-orderb`/api/pipeline/complete`bcalls.
bbb-b`test_tier2_schema_field_compatibility`:bValidatesbcompatibilitybwithbbothb`dependencies`bandb`dependencies_on`.
bbb-b`test_tier2_reset_and_isolation`:bVerifiesbthatbconsecutivebrunsbdobnotbleakbstatebacrossbpipelinebinitializations.
3.b**Tierb3:bRevisionbFeedbackbLoop**:
bbb-b`test_tier3_single_revision_flow`:bTestsb`CRITICS`breviseb$\to$b`CODEGEN`b$\to$b`CRITICS`bpassb$\to$b`COMPLETED`.
bbb-b`test_tier3_multi_revision_flow`:bTestsb2bconsecutivebrevisionsbbeforebpassing.
bbb-b`test_tier3_max_revisions_exceeded_quarantine`:bVerifiesbtransitionbtob`QUARANTINED`bwhenbrevisionbcapb(3)bisbexceeded.
bbb-b`test_tier3_terminal_fail_verdict`:bVerifiesbtransitionbtob`FAILED`bonbunrecoverablebfailure.
4.b**Tierb4:bMulti-ComponentbConcurrentbDAGbAcceptancebSimulation**:
bbb-b`test_tier4_concurrent_dag_acceptance_3_components`:bSimulatesb3bconcurrentbcomponentsb($Ab\tobB,bC$)bwithbinterleavedbstagebprogression,b0bdeadlocks,bandbverifiedbtopologicalbordering.
bbb-b`test_tier4_complex_stress_dag_simulation`:bSimulatesbab6-nodebmulti-layeredbdependencybgraph.
5.b**SubsystembUnitbContracts**:
bbb-b`test_state_transitions_quarantined_and_stalled_to_completed`:bValidatesbtransitionbrules.
bbb-b`test_priority_queue_min_heap_ordering`:bVerifiesbmin-heapborderingbandbtheb$-10000$brevisionbbonus.

###b7.2bEmpiricalbStressb&bChallengerbSuiteb(`test_pipeline_stress_challenge.py`)

`test_pipeline_stress_challenge.py`bexecutesb5badversarialbstressbscenarios:

1.b**Challengeb1:bMassiveb20-NodebMulti-TierbDAGbConcurrency**:bValidatesbhighbconcurrencybacrossb4blayersbofb5bnodesbeach,benforcingbstagebmutexbsingle-occupancybandbDAGbinvariantsbacrossb20bnodes.
2.b**Challengeb2:bInvertedbPrioritybOrderbDependencybResolution**:bTestsbDAGbwithbupstreamblow-prioritybnodesb(priorityb100)bblockingbdownstreambhigh-prioritybnodesb(priorityb1),bconfirmingbdependenciesbresolvebbeforebpriorities.
3.b**Challengeb3:bPoisonbPillbQuarantineb&bCascadebBehavior**:bInjectsbabfailingbcomponentbwithb$Kb\geb3$brevisions,bconfirmingbpoisonbpillbquarantinebandbdownstreambcascadebstallbwhilebindependentbsubgraphsbcomplete.
4.b**Challengeb4:bMulti-ThreadedbConcurrentbPollingb&bCompletionbRaces**:bSpawnsb10bconcurrentbthreadsbpollingb`/api/pipeline/tick`bandbpostingb`/api/pipeline/complete`,bverifyingbthreadbsafetybandb0bracebconditionbcrashes.
5.b**Challengeb5:bRandomizedbMontebCarlobFuzzing**:bRunsb10brandomizedbiterationsbwithbrandombtopologiesb(3–8bnodes),brandombpriorities,bandbrandomizedbrevisionbverdicts.

###b7.3bDecoratorb&bResiliencebUnitbSuiteb(`test_backoff.py`)

`test_backoff.py`b(1,287blines)bvalidatesbtheb`@with_exponential_backoff`bdecoratorbandbfallbackbrouting:
-bVerifiesbretrybdelaysbofb1.0sbandb2.0sbwithbsuccessbonbtheb3rdbattempt.
-bConfirmsbfast-failbbehaviorbonbnon-retryablebexceptionsb(`ValueError`,b`KeyError`,b400bBadbRequest).
-bVerifiesbretrybbehaviorbacrossbsyncbfunctions,bsyncbgenerators,basyncbcoroutines,bandbasyncbgeneratorbstreams.
-bTestsbmockbfallbackbfromb`gemini-3.6-flash`btob`gemini-3.5-flash-lite`bonb503bUNAVAILABLE.

###b7.4bFormalbVerificationbExecutionbProcedures

Tobrunbthebcompletebverificationbtestbsuitebacrossballbsubsystems:

```powershell
#b1.bRunbComprehensivebEnd-to-EndbPipelinebIntegrationbSuite
pytestbtest_pipeline_flow.pyb-v

#b2.bRunbAdversarialbConcurrencyb&bStressbChallengerbSuite
pytestbtest_pipeline_stress_challenge.pyb-v

#b3.bRunbUniversalbExponentialbBackoffb&bBalancerbResiliencebSuite
pythonb-mbunittestbtest_backoff.pyb-v

#b4.bRunbAllbTestbSuitesbinbUnifiedbSequence
pytestbtest_pipeline_flow.pybtest_pipeline_stress_challenge.pyb-v
```

---



###bAugb29,b2026b-bCriticalbDeadlockbDiagnosisb&bUIbFixes

####b1.bStagebLeasebTimeoutb(Theb"QueuedbforbCode"bDeadlock)
**Issue:**bUsersbexperiencedbabseverebdeadlockbwherebComponentb1bwouldbcompletebthebDESIGNbstagebbutbpermanentlybhangbinb"QueuedbforbCode",bpreventingbComponentsb2bandb3bfrombprogressing.
**RootbCause:**bTheb`PipelineConfig`bwasbdefaultingbtobab`lease_duration_sec`bofb`30.0`bseconds.bSincebthebLLMbgenerationbandbmanualbreviewbprocessbtookblongerbthanb30bseconds,bthebDAGblockbmanagerbproactivelybrevokedbthebleasebforbComponentb1.bWhenbthebUIbeventuallybcalledb`/api/pipeline/complete`,btheb`StageHandoverProtocol`bcorrectlybdetectedbthatbthebleasebwasblostbandbabortedbthebstagebhandover,bleavingbthebcomponentbpermanentlyborphanedbinb`IN_STAGE`bwithoutbenqueuingbitbtob`CODEGEN`.
**Fix:**bIncreasedbthebglobalb`lease_duration_sec`bandb`stage_timeout_sec`binb`PipelineConfig`btob`3600.0`bsecondsbtobsafelybaccommodatebmanualbhuman-in-the-loopbreviewbphasesbwithoutbprematureblockbrevocation.

####b2.bTerminalbLoggingbEnhancementsb&bCrashbResolution
-bImplementedbenrichedbterminalbloggingbtobdisplaybthebprecisebComponentbName,bAgentbactivebinbthebstage,bAPIbKeybinbuse,bandbRevisionbAttempts.
-bFixedbanb`AttributeError`b(`ComponentStatus.QUEUED`)binjectedbduringbthebterminalbupdatebwhichbwasbindependentlybfailingbthebpollingbmechanism.

####b3.bHorizontalbPipelinebCarouselbUIb&bToggler
-bRe-styledbthebcomponentbpipelinebgridbtobabstrictbhorizontalbcarousel.bComponentsbnowbrenderbwithbfullbwidthb`w-full`binsidebab`flex-row`bwithb`snap-x`bmechanics,beliminatingbverticalbscrolling.
-bRevertedbthebcomponentbblockbbackgroundsbtobthebrequestedb"OldbUI"baestheticb(brightbwhiteb`bg-white`,bslatebborders,bandbvibrantbtextbcolors).
-bImplementedbab"Pill-shapedbTogglebBar"babovebthebpipelinebtracks,ballowingbusersbtobrapidlybclickbabcomponent'sbnamebtobauto-scrollbthebcarouselbsmoothlybtobthatbspecificbcomponent.


####b4.bMonacobEditorbRevisionbHistorybIntegritybFix
-b**Issue:**bWhenbabcomponentbrequiredbrevisionbinbQUICKbmodeb(orbCOMPLEXbmode),bswitchingbbackbtobviewbtheb"Initial"brevisionbtabbresultedbinbthebverybfirstbfile'sbsourcebcodebdisplayingb`"Agentbisbwritingbcode..."`bratherbthanbthebinitialbgeneratedbcode.
-b**RootbCause:**bInb`backend/index.html`,b`startComponentCode`bcalledb`componentEditors[cId].setValue("Agentbisbwritingbcode...")`btobrenderbabloadingbplaceholder.bBecausebthebeditor'sb`activeRevisionIndex`bandb`activeFileIndex`bwerebstillbpointingbtobrevisionb0,bfileb0,bMonaco'sb`onDidChangeModelContent`blistenerbfiredbsynchronouslybandbmutatedb`state.revisionHistory[0].codebase.files[0].source_code`binbmemory.
-b**Fix:**bAddedb`isProgrammaticComponentEditorUpdate`bguardbflag,bguardedb`onDidChangeModelContent`btobignorebprogrammaticbupdatesbandbcheckb`state.statusb!==b'coding'`,bsafelybclonedb`prevCodebase`bbeforebsettingbloadingbplaceholders,bandbensuredb`switchComponentFile`bperformsbdeepbcloningbofbhistoricalbrevisionbcodebases.

####b5.bDynamicbRevisionbSystemb(HybridbApproachb-bProposalbE)
-b**Architecture**:bReplacesbfixedb1-3brevisionblimitsbwithbdynamicbbudgets,bweightedbseveritybcompositebscoring,bandbearly-stopbdeltabchecks.
-b**WeightedbCompositebFormula**:bCorrectnessb50%,bArchitectureb20%,bCompletenessb30%.
-b**Auto-PassbBoundary**:bIfbweightedbcompositebscoreb$\leb2.0$,bcomponentbauto-passesbcriticsbwithoutbinvokingbLLMbadjudicator.
-b**DynamicbBudgetbCalculation**:bComputedbdynamicallybasb$\min(5,b\lceil\text{composite}b/b3\rceil)$.
-b**Early-StopbDeltabDetection**:bIfbrevisionbimprovementbdeltabbetweenbconsecutivebcyclesb($\Deltab=b\text{previous\_composite}b-b\text{current\_composite}$)bisb$\leb1.0$,bearlybstopbterminatesbthebrevisionbcyclebwithbapprovalbtobpreventbdiminishingbreturns.
-b**FrontendbIntegration**:bUpdatedbsingle-pass,bcomponentbDAG,bandbintegrationbphasebself-correctionbloopsbinb`index.html`btobdynamicallybconsumebandbdisplaybbudgetballocationsb(e.g.,b"Attemptb1/4")bandbrespectbearly-stopbsignals.

*MasterbSystembDocumentationbcompiledbautonomouslybforbAutoDev.bVerifiedbagainstbGitbcommitbhistoryb(`c80d011`btob`d311039`),bsourcebcodebimplementations,bandbintegrationbtestbsuites.*



####b6.bJestbESM/CommonJSbCompatibilitybFix
-b**Issue:**bAutoDev-generatedbJavaScriptbprojectsbintermittentlybfailedbtestsbwithb`SyntaxError:bCannotbusebimportbstatementboutsidebabmodule`bbecauseb`jest.setup.js`bwasbwrittenbusingbESMb`import`bsyntaxbwhilebJestbrunsbinbCommonJSbmodebbybdefault.
-b**RootbCause:**bThebDesignbAgentbandbCodeGenbAgentbsystembpromptsbgavebnobguidancebonbJest'sbESMbvsbCommonJSbrequirements,bsobthebLLMbwouldbfreelybmixb`import`bandb`require`bdependingbonbcontext.
-b**Fix:**bAddedbexplicitbmandatorybrulesbtobbothb`backend/agents/design_agent.py`bandb`backend/agents/codegen_agent.py`binstructingbthebAIbtobalways:
bb1.bGenerateb`babel.config.js`bwithb`@babel/preset-env`btargetingb`node:b'current'`bb
bb2.bAddb`babel-jest`,b`@babel/core`,bandb`@babel/preset-env`btob`devDependencies`bb
bb3.bAddbab`jest`bconfigbblockbinb`package.json`bwithbtheb`babel-jest`btransformbandb`testEnvironment:bjsdom`bb
bb4.bWriteb`jest.setup.js`busingbCommonJSb`require()`bonlyb�bneverbESMb`import`

###bSepb07,b2026b-bCriticalbDeadlockbResolutionbandbDeterministicbRevision

####b1.bFrontendb"QueuedbforbCode"bDeadlockbFix
-b**Issue**:bUsersbexperiencedbabseverebpipelinebdeadlockbwhereb2borbmorebcomponentsbremainedbpermanentlybstuckbinbtheb"QueuedbforbCode"b(coding_queued)bstatebonbthebUI,bwhilebthebconsolebandbbackendbloggedbpartialbcompletions.
-b**RootbCause**:bIfbthebbrowser'sbfetchbcallsb(likeb/api/generate-code)bencounteredbabnetworkberror,brateblimit,borbbackendb500berror,bthebUIbcatch(e)bblockbcorrectlybupdatedbthebvisualbstatebtobfailed,bbutb**failedbtobnotifybthebbackend**.bThisbcausedbthebbackendblockbmanagerbtobpermanentlybholdbthebexclusivebCODEGENborbCRITICSblockbforbthatbcomponent.bDuebtobthebstrictbmutual-exclusionbdesignbofbthebDAGbengine,bnobsubsequentbcomponentsbcouldbenterbthebCODEGENbstage,bpermanentlybhangingbthebrestbofbthebpipelinebinbcoding_queued.
-b**Fix**:bAddedbexplicitblock-releasebAPIbcallsb(fetch('/api/pipeline/complete',b{bverdict:b'error'b}))btoballbpipelinebcatchbblocksbinbackend/index.html.bModifiedbackend/autodev_pipeline/scheduler.pybtobcorrectlybinterpretberdictb==b'error'bbybunconditionallybreleasingbthebstageblock,btransitioningbthebcomponentbtobFAILED,bandbhaltingbdownstreambdependenciesbwithoutbstallingbthebentirebDAG.

####b2.bDeterministicbAdjudicatorb&bTestingbOverhaul
-bRemovedbthebstochasticbLLM-basedb
ode_adjudicatorbentirely,breplacingbitbwithbabdeterministicbPythonbgate-logicbenginebinbackend/orchestrator.py.
-bReplacedbJestbwithbVitestb+bESMbforbmodernbfrontendbtesting,bavoidingbCommonJSblegacybmodulebconflicts.
-bAddedbE2EbtestingbsupportbusingbPlaywright.
-bIncreasedbthebsandboxbDockerbtimeoutbfromb60sbtob180sbtobpreventbprematurebterminationbofbcomplexbVitest/Playwrightbsuites.
