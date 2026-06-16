import type { CareerHorizon, StudyCategory } from '@/server/types/index'

// Conteúdo padrão do plano de carreira (semente no primeiro acesso).
// Mantido em português por ser conteúdo de leitura do usuário.

export const DEFAULT_CAREER_PROFILE = {
  north_star:
    'Tornar-se Arquiteto(a) de Soluções de IA / Product Lead de IA Industrial — a ponte entre o time de IA e o chão de fábrica (manufatura/automotivo).',
  track: null as null,
  rationale:
    'O diferencial não é treinar modelos (milhares sabem), e sim o cruzamento raro: Visão Computacional 3D + Edge AI/IA embarcada + Automação industrial (PLC/Indústria 4.0) + Visão de Produto. Esse perfil é estratégico e escasso numa montadora como a BYD. IA + manufatura é uma das maiores ondas da década; visão 3D é difícil de comoditizar e Edge AI cresce porque a inferência precisa acontecer perto da máquina.',
  principles: [
    'Aprenda no trabalho: transforme tarefas reais em projetos de portfólio (sem expor dados confidenciais).',
    'Profundidade em T: fundo em visão computacional/IA industrial, largura em produto, cloud e automação.',
    'Documente tudo (GitHub + LinkedIn): sua carreira é a soma do que os outros veem que você fez.',
    'Negocie escopo, não só salário: projetos visíveis hoje valem mais que 5% de aumento.',
    'Networking dirigido: conecte-se com quem já está no cargo-alvo e pergunte como chegou lá.',
    'Regra de ouro: a cada tema estudado, entregue um projeto. Conhecimento que não vira portfólio não conta.',
  ] as string[],
}

interface SeedMilestone {
  title: string
  description: string
  horizon: CareerHorizon
}

export const DEFAULT_CAREER_MILESTONES: SeedMilestone[] = [
  // Horizonte 0–6 meses
  {
    title: 'Python para dados/IA + engenharia de software',
    description: 'NumPy, Pandas, OpenCV, Git, testes e tipagem. Base sólida — sem ela o resto trava.',
    horizon: '0-6m',
  },
  {
    title: 'Visão computacional clássica + 3D',
    description: 'Calibração de câmera, estéreo/profundidade, point clouds (Open3D) — agora com fundamento.',
    horizon: '0-6m',
  },
  {
    title: 'Deep Learning aplicado (PyTorch)',
    description: 'CNNs, detecção e segmentação (YOLO, Detectron2), fine-tuning.',
    horizon: '0-6m',
  },
  {
    title: 'Projeto-portfólio nº 1',
    description: 'Inspeção visual de defeitos com câmera 3D, ponta a ponta, documentado no GitHub. Vale mais que certificado.',
    horizon: '0-6m',
  },
  // Horizonte 6–18 meses
  {
    title: 'Edge AI / IA embarcada',
    description: 'NVIDIA Jetson, TensorRT, ONNX, quantização. Rodar o modelo perto da máquina.',
    horizon: '6-18m',
  },
  {
    title: 'MLOps',
    description: 'Versionamento de modelo, monitoramento, pipelines (MLflow, Docker, CI/CD).',
    horizon: '6-18m',
  },
  {
    title: 'GenAI / Agentes / LLMs aplicados',
    description: 'RAG, agentes e automação de processos com LLMs.',
    horizon: '6-18m',
  },
  {
    title: 'Indústria 4.0: PLC + Digital Twin',
    description: 'OPC-UA, MQTT, gêmeos digitais. Une seus dois mundos e te torna insubstituível.',
    horizon: '6-18m',
  },
  {
    title: 'Certificação cloud',
    description: 'AWS ML Specialty ou Azure AI Engineer Associate.',
    horizon: '6-18m',
  },
  {
    title: 'Movimento de carreira: ownership real',
    description: 'Sair de assistente para analista/engenheiro de produto de IA, com ownership de uma feature/produto.',
    horizon: '6-18m',
  },
  // Horizonte 18–36 meses
  {
    title: 'Liderança técnica',
    description: 'Liderar iniciativas ponta a ponta, mentorar e influenciar roadmap. Soft skills passam a pesar mais que código.',
    horizon: '18-36m',
  },
  {
    title: 'Especialização formal',
    description: 'Pós/mestrado em Visão Computacional/IA (trilha técnica) ou MBA em Gestão de Produto/Tech (trilha de produto).',
    horizon: '18-36m',
  },
  {
    title: 'Posição-alvo: AI Solutions Architect / AI Product Lead',
    description: 'Assumir a posição-alvo do norte estratégico.',
    horizon: '18-36m',
  },
  {
    title: 'Marca pessoal',
    description: 'LinkedIn, artigos, palestras, open source. Visibilidade abre portas que o currículo sozinho não abre.',
    horizon: '18-36m',
  },
]

interface SeedStudyItem {
  title: string
  description: string
  category: StudyCategory
  resource_url: string | null
}

export const DEFAULT_STUDY_ITEMS: SeedStudyItem[] = [
  {
    title: 'Deep Learning',
    description: 'Deep Learning Specialization — DeepLearning.AI (Coursera).',
    category: 'course',
    resource_url: 'https://www.coursera.org/specializations/deep-learning',
  },
  {
    title: 'Visão computacional',
    description: 'First Principles of Computer Vision (Shree Nayar, YouTube) + OpenCV/Open3D.',
    category: 'course',
    resource_url: 'https://www.youtube.com/@firstprinciplesofcomputerv3258',
  },
  {
    title: 'PyTorch prático',
    description: 'Practical Deep Learning for Coders — fast.ai.',
    category: 'course',
    resource_url: 'https://course.fast.ai/',
  },
  {
    title: 'MLOps',
    description: 'MLOps Zoomcamp — DataTalksClub (gratuito, GitHub).',
    category: 'course',
    resource_url: 'https://github.com/DataTalksClub/mlops-zoomcamp',
  },
  {
    title: 'Edge AI',
    description: 'Cursos NVIDIA DLI (Jetson) + docs TensorRT/ONNX.',
    category: 'course',
    resource_url: 'https://www.nvidia.com/en-us/training/',
  },
  {
    title: 'GenAI / Agentes',
    description: 'Documentação Anthropic/OpenAI + projetos próprios de RAG/agentes.',
    category: 'course',
    resource_url: 'https://docs.anthropic.com/',
  },
  {
    title: 'Cloud',
    description: 'Trilha oficial AWS ML Specialty ou Azure AI Engineer.',
    category: 'certification',
    resource_url: null,
  },
]
