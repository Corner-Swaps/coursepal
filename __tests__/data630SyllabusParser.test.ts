import fs from 'fs';
import path from 'path';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';

describe('DATA 630 Syllabus Parser & Mapping Suite', () => {
  const rawText = fs.readFileSync(path.join(__dirname, 'data630_raw_text.txt'), 'utf-8');

  it('correctly parses course metadata, assignments, and weekly schedule with technical readings', () => {
    const parsed = LocalSyllabusParser.shared.parseText(rawText);

    // 1. Basic course metadata
    expect(parsed.courseCode).toBe('DATA 630');
    expect(parsed.courseName).toMatch(/Scalable Machine Learning Systems & Cloud AI Architectures/i);
    expect(parsed.instructorName).toMatch(/Marcus Vance/i);
    expect(parsed.instructorEmail).toBe('mvance@eng.cloudtech.edu');

    // 2. Course Assignments & Weight Distribution
    // Must have exactly 4 assignments matching the CoursePal Parser & Application Mapping Guide:
    // 1) Distributed Training Benchmark Project (30%)
    // 2) Production Inference Microservice & Load Test (25%)
    // 3) Automated End-to-End MLOps Pipeline Capstone (30%)
    // 4) Architecture Seminar & Code Reviews (15%)
    expect(parsed.assignments).toBeDefined();
    expect(parsed.assignments?.length).toBe(4);

    const titles = parsed.assignments?.map(a => a.title) || [];
    expect(titles).toEqual([
      'Distributed Training Benchmark Project',
      'Production Inference Microservice & Load Test',
      'Automated End-to-End MLOps Pipeline Capstone',
      'Architecture Seminar & Code Reviews'
    ]);

    const dtProj = parsed.assignments?.find(a => a.title.includes('Distributed Training Benchmark'));
    expect(dtProj).toBeDefined();
    expect(dtProj?.weightPercentage).toBe('30%');

    const infService = parsed.assignments?.find(a => a.title.includes('Production Inference Microservice'));
    expect(infService).toBeDefined();
    expect(infService?.weightPercentage).toBe('25%');

    const mlopsCap = parsed.assignments?.find(a => a.title.includes('Automated End-to-End MLOps Pipeline'));
    expect(mlopsCap).toBeDefined();
    expect(mlopsCap?.weightPercentage).toBe('30%');

    const seminar = parsed.assignments?.find(a => a.title.includes('Architecture Seminar & Code Reviews'));
    expect(seminar).toBeDefined();
    expect(seminar?.weightPercentage).toBe('15%');

    // Make sure no paragraphs or syllabus instructions leaked into assignment titles
    for (const a of parsed.assignments || []) {
      expect(a.title.length).toBeLessThan(80);
      expect(a.title).not.toMatch(/Students implement|Transformer architecture|In teams of two|Evaluated through/i);
    }

    // 3. Weekly Schedule (All 11 Weeks with Clean Themes and Readings)
    expect(parsed.weeks).toBeDefined();
    expect(parsed.weeks?.length).toBe(11);

    // Verify Themes
    expect(parsed.weeks?.[0]?.theme).toBe('MODULE 01: ML Systems Architecture & Data Ingestion Pipelines');
    expect(parsed.weeks?.[1]?.theme).toBe('MODULE 02: Feature Engineering at Scale & Feature Stores');
    expect(parsed.weeks?.[2]?.theme).toBe('MODULE 03: Distributed Data-Parallel Training (DDP & Horovod)');
    expect(parsed.weeks?.[3]?.theme).toBe('MODULE 04: Model Parallelism, ZeRO & DeepSpeed Optimization');
    expect(parsed.weeks?.[4]?.theme).toBe('MODULE 05: Model Compression: Quantization, LoRA & Distillation');
    expect(parsed.weeks?.[5]?.theme).toBe('MODULE 06: Serving Infrastructure & Continuous Batching');
    expect(parsed.weeks?.[6]?.theme).toBe('MODULE 07: Container Orchestration & Kubernetes for Machine Learning');
    expect(parsed.weeks?.[7]?.theme).toBe('MODULE 08: Monitoring, Observability & Data Drift Detection');
    expect(parsed.weeks?.[8]?.theme).toBe('MODULE 09: Workflow Orchestration with Airflow & Prefect');
    expect(parsed.weeks?.[9]?.theme).toBe('MODULE 10: Cost Governance, Spot Instances & Cloud FinOps for AI');
    expect(parsed.weeks?.[10]?.theme).toBe('MODULE 11: Final Capstone Showcase, Live Demos & Term Retrospective');

    // Verify Readings for Each Week
    // Week 1: Huyen (Ch. 1–3); Kleppmann (Ch. 1)
    const w1Readings = parsed.weeks?.[0]?.readings?.map(r => r.title) || [];
    expect(w1Readings).toContain('Huyen (Ch. 1–3)');
    expect(w1Readings).toContain('Kleppmann (Ch. 1)');

    // Week 2: Huyen (Ch. 4 & 5); Feast Architecture Specs
    const w2Readings = parsed.weeks?.[1]?.readings?.map(r => r.title) || [];
    expect(w2Readings).toContain('Huyen (Ch. 4 & 5)');
    expect(w2Readings).toContain('Feast Architecture Specs');

    // Week 3: PyTorch Distributed Docs; Li et al. (2020)
    const w3Readings = parsed.weeks?.[2]?.readings?.map(r => r.title) || [];
    expect(w3Readings).toContain('PyTorch Distributed Docs');
    expect(w3Readings).toContain('Li et al. (2020)');

    // Week 4: Rajbhandari et al. (2020); Shoeybi et al. (Megatron)
    const w4Readings = parsed.weeks?.[3]?.readings?.map(r => r.title) || [];
    expect(w4Readings).toContain('Rajbhandari et al. (2020)');
    expect(w4Readings).toContain('Shoeybi et al. (Megatron)');

    // Week 5: Dettmers et al. (QLoRA); Hu et al. (LoRA)
    const w5Readings = parsed.weeks?.[4]?.readings?.map(r => r.title) || [];
    expect(w5Readings).toContain('Dettmers et al. (QLoRA)');
    expect(w5Readings).toContain('Hu et al. (LoRA)');

    // Week 6: Triton User Guide; vLLM Technical Paper
    const w6Readings = parsed.weeks?.[5]?.readings?.map(r => r.title) || [];
    expect(w6Readings).toContain('Triton User Guide');
    expect(w6Readings).toContain('vLLM Technical Paper');

    // Week 7: Burns et al. (Ch. 4–6); Kubeflow Operator Docs
    const w7Readings = parsed.weeks?.[6]?.readings?.map(r => r.title) || [];
    expect(w7Readings).toContain('Burns et al. (Ch. 4–6)');
    expect(w7Readings).toContain('Kubeflow Operator Docs');

    // Week 8: Huyen (Ch. 8 & 9); Evidently AI Whitepaper
    const w8Readings = parsed.weeks?.[7]?.readings?.map(r => r.title) || [];
    expect(w8Readings).toContain('Huyen (Ch. 8 & 9)');
    expect(w8Readings).toContain('Evidently AI Whitepaper');

    // Week 9: Huyen (Ch. 6); Apache Airflow Core Architecture
    const w9Readings = parsed.weeks?.[8]?.readings?.map(r => r.title) || [];
    expect(w9Readings).toContain('Huyen (Ch. 6)');
    expect(w9Readings).toContain('Apache Airflow Core Architecture');

    // Week 10: Cloud AI Pricing Guides; Stoica et al. (Ray Paper)
    const w10Readings = parsed.weeks?.[9]?.readings?.map(r => r.title) || [];
    expect(w10Readings).toContain('Cloud AI Pricing Guides');
    expect(w10Readings).toContain('Stoica et al. (Ray Paper)');

    // Week 11: Industry System Architecture Whitepapers
    const w11Readings = parsed.weeks?.[10]?.readings?.map(r => r.title) || [];
    expect(w11Readings).toContain('Industry System Architecture Whitepapers');
  });

  it('correctly parses iOS-extracted text of DATA 630 with multi-column deinterleaving', () => {
    const iosRawText = rawText;
    const parsed = LocalSyllabusParser.shared.parseText(iosRawText);

    expect(parsed.courseCode).toBe('DATA 630');
    expect(parsed.courseName).toMatch(/Scalable Machine Learning Systems & Cloud AI Architectures/i);

    expect(parsed.assignments?.length).toBe(4);
    const titles = parsed.assignments?.map(a => a.title) || [];
    expect(titles).toEqual([
      'Distributed Training Benchmark Project',
      'Production Inference Microservice & Load Test',
      'Automated End-to-End MLOps Pipeline Capstone',
      'Architecture Seminar & Code Reviews'
    ]);

    expect(parsed.weeks?.length).toBe(11);

    // Week 2: Feast Architecture Specs (must NOT be Stores Specs)
    expect(parsed.weeks?.[1]?.theme).toBe('MODULE 02: Feature Engineering at Scale & Feature Stores');
    const w2Readings = parsed.weeks?.[1]?.readings?.map(r => r.title) || [];
    expect(w2Readings).toContain('Huyen (Ch. 4 & 5)');
    expect(w2Readings).toContain('Feast Architecture Specs');
    expect(w2Readings).not.toContain('Stores Specs');

    // Week 3: Li et al. (2020)
    expect(parsed.weeks?.[2]?.theme).toBe('MODULE 03: Distributed Data-Parallel Training (DDP & Horovod)');
    const w3Readings = parsed.weeks?.[2]?.readings?.map(r => r.title) || [];
    expect(w3Readings).toContain('Li et al. (2020)');
    expect(w3Readings).toContain('PyTorch Distributed Docs');

    // Week 4: Shoeybi et al. (Megatron) & Rajbhandari et al. (2020)
    expect(parsed.weeks?.[3]?.theme).toBe('MODULE 04: Model Parallelism, ZeRO & DeepSpeed Optimization');
    const w4Readings = parsed.weeks?.[3]?.readings?.map(r => r.title) || [];
    expect(w4Readings).toContain('Rajbhandari et al. (2020)');
    expect(w4Readings).toContain('Shoeybi et al. (Megatron)');

    // Week 6: Triton User Guide & vLLM Technical Paper
    expect(parsed.weeks?.[5]?.theme).toBe('MODULE 06: Serving Infrastructure & Continuous Batching');
    const w6Readings = parsed.weeks?.[5]?.readings?.map(r => r.title) || [];
    expect(w6Readings).toContain('Triton User Guide');
    expect(w6Readings).toContain('vLLM Technical Paper');
    expect(w6Readings).not.toContain('Burns et al. (Ch. 4–6)');

    // Week 7: Burns et al. (Ch. 4–6) & Kubeflow Operator Docs
    expect(parsed.weeks?.[6]?.theme).toBe('MODULE 07: Container Orchestration & Kubernetes for Machine Learning');
    const w7Readings = parsed.weeks?.[6]?.readings?.map(r => r.title) || [];
    expect(w7Readings).toContain('Burns et al. (Ch. 4–6)');
    expect(w7Readings).toContain('Kubeflow Operator Docs');

    // Week 8: Evidently AI Whitepaper
    const w8Readings = parsed.weeks?.[7]?.readings?.map(r => r.title) || [];
    expect(w8Readings).toContain('Evidently AI Whitepaper');

    // Week 9: Apache Airflow Core Architecture
    const w9Readings = parsed.weeks?.[8]?.readings?.map(r => r.title) || [];
    expect(w9Readings).toContain('Apache Airflow Core Architecture');

    // Week 10: Stoica et al. (Ray Paper)
    const w10Readings = parsed.weeks?.[9]?.readings?.map(r => r.title) || [];
    expect(w10Readings).toContain('Stoica et al. (Ray Paper)');

    // Week 11: Industry System Architecture Whitepapers
    const w11Readings = parsed.weeks?.[10]?.readings?.map(r => r.title) || [];
    expect(w11Readings).toContain('Industry System Architecture Whitepapers');
  });
});
