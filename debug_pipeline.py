from pipeline_api import scheduler

print("DAG Components:")
for cid, comp in scheduler.dag.components.items():
    print(f"{cid}: status={comp.status}, current_stage={comp.current_stage}")

print("Queues:")
for stage, queue in scheduler.queue_manager._queues.items():
    print(f"{stage}: {[q.component_id for q in queue.queue]}")
