import { Request, Response } from 'express';
import InterviewSession from '../models/InterviewSession.js';

// Generate interview questions based on job description
export const generateQuestions = async (req: Request, res: Response) => {
  try {
    const { jobDescription, userExperience, seniorityLevel, roleType } = req.body;
    
    const questions = generateQuestionsByCategory(jobDescription, seniorityLevel, roleType);
    const starTemplates = generateStarTemplates(userExperience, questions);
    
    res.json({
      success: true,
      data: {
        questions,
        starTemplates,
        totalQuestions: questions.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate questions' });
  }
};

// Create practice session
export const createSession = async (req: Request, res: Response) => {
  try {
    const { userId, questions, jobId } = req.body;
    
    const session = new InterviewSession({
      userId,
      jobId,
      questions,
      status: 'active',
      createdAt: new Date()
    });
    
    await session.save();
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
};

// Update practice session with answers
export const updateSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { questionId, answer, timeSpent } = req.body;
    
    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    session.answers.push({ questionId, answer, timeSpent, answeredAt: new Date() });
    await session.save();
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update session' });
  }
};

// Get user's practice sessions
export const getUserSessions = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const sessions = await InterviewSession.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

// Complete session and get analytics
export const completeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    session.status = 'completed';
    session.completedAt = new Date();
    session.analytics = generateAnalytics(session);
    
    await session.save();
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete session' });
  }
};

// Helper functions
function generateQuestionsByCategory(jobDescription: string, seniorityLevel: string, roleType: string) {
  const behavioral = [
    "Tell me about a time you overcame a significant challenge",
    "Describe a situation where you had to work with a difficult team member",
    "Give an example of when you had to adapt to change quickly"
  ];
  
  const technical = roleType === 'technical' ? [
    "How would you approach solving this technical problem?",
    "Explain your experience with relevant technologies",
    "Walk me through your development process"
  ] : [
    "How do you prioritize tasks when everything seems urgent?",
    "Describe your approach to problem-solving"
  ];
  
  const roleSpecific = [
    `Why are you interested in this ${roleType} position?`,
    "What unique value would you bring to our team?",
    "How do you stay updated with industry trends?"
  ];
  
  return [...behavioral, ...technical, ...roleSpecific];
}

function generateStarTemplates(userExperience: any, questions: string[]) {
  return questions.map((question, index) => ({
    questionId: index,
    question,
    template: {
      situation: "Based on your experience, describe the context...",
      task: "What was your responsibility or goal?",
      action: "What specific steps did you take?",
      result: "What was the outcome and impact?"
    }
  }));
}

function generateAnalytics(session: any) {
  return {
    totalQuestions: session.questions.length,
    answered: session.answers.length,
    averageTimePerQuestion: session.answers.reduce((acc: number, curr: any) => acc + curr.timeSpent, 0) / session.answers.length || 0,
    completionRate: (session.answers.length / session.questions.length) * 100,
    suggestions: [
      "Practice STAR format for behavioral questions",
      "Research company-specific examples",
      "Prepare quantified results for your achievements"
    ]
  };
}