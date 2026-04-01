import { Request, Response } from 'express';
import InterviewSession from '../models/InterviewSession.js';
import User from '../models/User.js';
import ApplicationKit from '../models/ApplicationKit.js';

interface GenerateQuestionsRequest extends Request {
  body: {
    jobDescription: string;
    applicationKitId: string;
    roleType: string;
    seniorityLevel: string;
  };
}

interface StartPracticeRequest extends Request {
  body: {
    questionSetId: string;
    applicationKitId: string;
  };
}

interface SubmitAnswerRequest extends Request {
  body: {
    sessionId: string;
    questionId: string;
    answer: string;
    timeSpent: number;
  };
}

// Generate interview questions based on job description and user profile
export const generateQuestions = async (req: GenerateQuestionsRequest, res: Response) => {
  try {
    const { jobDescription, applicationKitId, roleType, seniorityLevel } = req.body;
    const userId = req.user?.id;

    if (!userId || !jobDescription || !applicationKitId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user profile and application kit for context
    const user = await User.findById(userId);
    const applicationKit = await ApplicationKit.findById(applicationKitId);

    if (!user || !applicationKit) {
      return res.status(404).json({ error: 'User or application kit not found' });
    }

    // Generate different categories of questions
    const behavioralQuestions = generateBehavioralQuestions(seniorityLevel);
    const technicalQuestions = generateTechnicalQuestions(roleType, seniorityLevel, jobDescription);
    const roleSpecificQuestions = generateRoleSpecificQuestions(jobDescription, roleType);
    const situationalQuestions = generateSituationalQuestions(seniorityLevel);

    const allQuestions = [
      ...behavioralQuestions,
      ...technicalQuestions,
      ...roleSpecificQuestions,
      ...situationalQuestions
    ];

    // Generate STAR format answer templates using user's experience
    const questionsWithTemplates = await Promise.all(
      allQuestions.map(async (question) => {
        const starTemplate = await generateSTARTemplate(question, user, applicationKit);
        return {
          ...question,
          starTemplate,
          id: generateQuestionId()
        };
      })
    );

    // Create interview session record
    const interviewSession = new InterviewSession({
      userId,
      applicationKitId,
      jobDescription,
      roleType,
      seniorityLevel,
      questions: questionsWithTemplates,
      status: 'generated',
      createdAt: new Date()
    });

    await interviewSession.save();

    res.status(201).json({
      success: true,
      data: {
        sessionId: interviewSession._id,
        questions: questionsWithTemplates,
        totalQuestions: questionsWithTemplates.length,
        categories: {
          behavioral: behavioralQuestions.length,
          technical: technicalQuestions.length,
          roleSpecific: roleSpecificQuestions.length,
          situational: situationalQuestions.length
        }
      }
    });

  } catch (error) {
    console.error('Error generating interview questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Start a practice session
export const startPracticeSession = async (req: StartPracticeRequest, res: Response) => {
  try {
    const { questionSetId, applicationKitId } = req.body;
    const userId = req.user?.id;

    if (!userId || !questionSetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const interviewSession = await InterviewSession.findById(questionSetId);
    
    if (!interviewSession || interviewSession.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Interview session not found' });
    }

    // Update session status and start time
    interviewSession.status = 'in_progress';
    interviewSession.startedAt = new Date();
    interviewSession.practiceAttempts = (interviewSession.practiceAttempts || 0) + 1;
    
    await interviewSession.save();

    res.json({
      success: true,
      data: {
        sessionId: interviewSession._id,
        questions: interviewSession.questions,
        currentQuestionIndex: 0,
        totalQuestions: interviewSession.questions.length
      }
    });

  } catch (error) {
    console.error('Error starting practice session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit answer for a question during practice
export const submitAnswer = async (req: SubmitAnswerRequest, res: Response) => {
  try {
    const { sessionId, questionId, answer, timeSpent } = req.body;
    const userId = req.user?.id;

    if (!userId || !sessionId || !questionId || !answer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const interviewSession = await InterviewSession.findById(sessionId);
    
    if (!interviewSession || interviewSession.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Interview session not found' });
    }

    // Find the question and update with user's answer
    const questionIndex = interviewSession.questions.findIndex(q => q.id === questionId);
    
    if (questionIndex === -1) {
      return res.status(404).json({ error: 'Question not found' });
    }

    interviewSession.questions[questionIndex].userAnswer = answer;
    interviewSession.questions[questionIndex].timeSpent = timeSpent;
    interviewSession.questions[questionIndex].answeredAt = new Date();

    // Generate improvement suggestions based on answer
    const improvementSuggestions = generateImprovementSuggestions(
      interviewSession.questions[questionIndex],
      answer
    );

    interviewSession.questions[questionIndex].improvementSuggestions = improvementSuggestions;

    await interviewSession.save();

    res.json({
      success: true,
      data: {
        questionId,
        improvementSuggestions,
        nextQuestionIndex: questionIndex + 1,
        totalQuestions: interviewSession.questions.length
      }
    });

  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Complete practice session
export const completePracticeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId || !sessionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const interviewSession = await InterviewSession.findById(sessionId);
    
    if (!interviewSession || interviewSession.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Interview session not found' });
    }

    interviewSession.status = 'completed';
    interviewSession.completedAt = new Date();
    
    // Calculate session statistics
    const answeredQuestions = interviewSession.questions.filter(q => q.userAnswer);
    const totalTime = interviewSession.questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0);
    const averageTimePerQuestion = answeredQuestions.length > 0 ? totalTime / answeredQuestions.length : 0;

    interviewSession.sessionStats = {
      totalQuestions: interviewSession.questions.length,
      answeredQuestions: answeredQuestions.length,
      completionRate: (answeredQuestions.length / interviewSession.questions.length) * 100,
      totalTimeSpent: totalTime,
      averageTimePerQuestion
    };

    await interviewSession.save();

    res.json({
      success: true,
      data: {
        sessionId: interviewSession._id,
        stats: interviewSession.sessionStats,
        completedAt: interviewSession.completedAt
      }
    });

  } catch (error) {
    console.error('Error completing practice session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get practice history for user
export const getPracticeHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessions = await InterviewSession.find({ userId })
      .populate('applicationKitId', 'jobTitle company')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('Error fetching practice history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get specific interview session
export const getInterviewSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId || !sessionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const interviewSession = await InterviewSession.findById(sessionId)
      .populate('applicationKitId', 'jobTitle company jobDescription');
    
    if (!interviewSession || interviewSession.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Interview session not found' });
    }

    res.json({
      success: true,
      data: interviewSession
    });

  } catch (error) {
    console.error('Error fetching interview session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper functions
function generateBehavioralQuestions(seniorityLevel: string) {
  const questions = [
    {
      category: 'behavioral',
      question: 'Tell me about a time when you had to work under pressure.',
      difficulty: seniorityLevel === 'senior' ? 'advanced' : 'intermediate'
    },
    {
      category: 'behavioral',
      question: 'Describe a situation where you had to resolve a conflict with a team member.',
      difficulty: seniorityLevel === 'entry' ? 'basic' : 'intermediate'
    },
    {
      category: 'behavioral',
      question: 'Give me an example of a time when you had to adapt to a significant change.',
      difficulty: 'intermediate'
    },
    {
      category: 'behavioral',
      question: 'Tell me about a project you led from start to finish.',
      difficulty: seniorityLevel === 'entry' ? 'intermediate' : 'advanced'
    }
  ];

  return seniorityLevel === 'entry' ? questions.slice(0, 3) : questions;
}

function generateTechnicalQuestions(roleType: string, seniorityLevel: string, jobDescription: string) {
  // This would integrate with AI service to generate role-specific technical questions
  const baseQuestions = [
    {
      category: 'technical',
      question: `What are the key technical skills required for a ${roleType} role?`,
      difficulty: 'basic'
    },
    {
      category: 'technical',
      question: 'How do you stay updated with the latest technologies in your field?',
      difficulty: 'intermediate'
    }
  ];

  if (seniorityLevel === 'senior') {
    baseQuestions.push({
      category: 'technical',
      question: 'How would you architect a solution for [specific scenario from job description]?',
      difficulty: 'advanced'
    });
  }

  return baseQuestions;
}

function generateRoleSpecificQuestions(jobDescription: string, roleType: string) {
  // This would use AI to analyze job description and generate specific questions
  return [
    {
      category: 'role-specific',
      question: `What interests you most about this ${roleType} position?`,
      difficulty: 'basic'
    },
    {
      category: 'role-specific',
      question: 'How does your experience align with our job requirements?',
      difficulty: 'intermediate'
    }
  ];
}

function generateSituationalQuestions(seniorityLevel: string) {
  const questions = [
    {
      category: 'situational',
      question: 'How would you handle a situation where you disagree with your manager?',
      difficulty: 'intermediate'
    },
    {
      category: 'situational',
      question: 'What would you do if you realized you made a mistake that affected the team?',
      difficulty: 'basic'
    }
  ];

  if (seniorityLevel === 'senior') {
    questions.push({
      category: 'situational',
      question: 'How would you handle a situation where you need to deliver bad news to stakeholders?',
      difficulty: 'advanced'
    });
  }

  return questions;
}

async function generateSTARTemplate(question: any, user: any, applicationKit: any) {
  // This would integrate with AI service to generate personalized STAR format templates
  return {
    situation: 'Describe a specific situation from your experience...',
    task: 'Explain what task or challenge you were facing...',
    action: 'Detail the specific actions you took...',
    result: 'Share the positive outcome or what you learned...',
    tips: [
      'Be specific and use concrete examples',
      'Quantify your results when possible',
      'Keep your answer focused and concise'
    ]
  };
}

function generateImprovementSuggestions(question: any, answer: string) {
  // This would use AI to analyze the answer and provide suggestions
  return [
    'Consider providing more specific examples',
    'Try to quantify your results where possible',
    'Structure your answer using the STAR method'
  ];
}

function generateQuestionId() {
  return Math.random().toString(36).substr(2, 9);
}