import { Schema, model, Document } from 'mongoose';

interface IQuestion {
  id: string;
  question: string;
  category: 'behavioral' | 'technical' | 'role-specific';
  difficulty: 'entry' | 'mid' | 'senior' | 'executive';
  suggestedAnswer?: string;
  starTemplate?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

interface IPracticeAnswer {
  questionId: string;
  userAnswer: string;
  timeSpent: number; // in seconds
  confidence: number; // 1-5 scale
  answeredAt: Date;
  feedback?: string;
  improvementSuggestions?: string[];
}

interface IInterviewSession extends Document {
  userId: string;
  jobId?: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  seniorityLevel: 'entry' | 'mid' | 'senior' | 'executive';
  roleType: string;
  questions: IQuestion[];
  practiceAnswers: IPracticeAnswer[];
  sessionStatus: 'created' | 'in_progress' | 'completed' | 'archived';
  totalTimeSpent: number; // in seconds
  completionPercentage: number;
  overallConfidence: number; // 1-5 scale
  lastPracticedAt?: Date;
  interviewDate?: Date;
  notes?: string;
  improvementAreas: string[];
  strengths: string[];
  sessionMetadata: {
    questionsGenerated: number;
    averageAnswerTime: number;
    mostPracticedCategory: string;
    weakestCategory: string;
  };
}

const questionSchema = new Schema({
  id: { type: String, required: true },
  question: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['behavioral', 'technical', 'role-specific']
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['entry', 'mid', 'senior', 'executive']
  },
  suggestedAnswer: { type: String },
  starTemplate: {
    situation: { type: String },
    task: { type: String },
    action: { type: String },
    result: { type: String }
  }
}, { _id: false });

const practiceAnswerSchema = new Schema({
  questionId: { type: String, required: true },
  userAnswer: { type: String, required: true },
  timeSpent: { type: Number, required: true, min: 0 },
  confidence: { type: Number, required: true, min: 1, max: 5 },
  answeredAt: { type: Date, required: true, default: Date.now },
  feedback: { type: String },
  improvementSuggestions: [{ type: String }]
}, { _id: false });

const interviewSessionSchema = new Schema<IInterviewSession>({
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  jobId: { type: String },
  jobTitle: { 
    type: String, 
    required: true,
    trim: true
  },
  companyName: { 
    type: String, 
    required: true,
    trim: true
  },
  jobDescription: { 
    type: String, 
    required: true
  },
  seniorityLevel: {
    type: String,
    required: true,
    enum: ['entry', 'mid', 'senior', 'executive'],
    default: 'mid'
  },
  roleType: { 
    type: String, 
    required: true,
    trim: true
  },
  questions: [questionSchema],
  practiceAnswers: [practiceAnswerSchema],
  sessionStatus: {
    type: String,
    required: true,
    enum: ['created', 'in_progress', 'completed', 'archived'],
    default: 'created'
  },
  totalTimeSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  overallConfidence: {
    type: Number,
    min: 1,
    max: 5
  },
  lastPracticedAt: { type: Date },
  interviewDate: { type: Date },
  notes: { type: String },
  improvementAreas: [{ type: String }],
  strengths: [{ type: String }],
  sessionMetadata: {
    questionsGenerated: { type: Number, default: 0 },
    averageAnswerTime: { type: Number, default: 0 },
    mostPracticedCategory: { type: String },
    weakestCategory: { type: String }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
interviewSessionSchema.index({ userId: 1, createdAt: -1 });
interviewSessionSchema.index({ sessionStatus: 1 });
interviewSessionSchema.index({ interviewDate: 1 });

// Virtual for questions by category
interviewSessionSchema.virtual('questionsByCategory').get(function() {
  return this.questions.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {});
});

// Virtual for practice statistics
interviewSessionSchema.virtual('practiceStats').get(function() {
  const answers = this.practiceAnswers;
  if (answers.length === 0) return null;
  
  const totalAnswers = answers.length;
  const avgConfidence = answers.reduce((sum, answer) => sum + answer.confidence, 0) / totalAnswers;
  const avgTime = answers.reduce((sum, answer) => sum + answer.timeSpent, 0) / totalAnswers;
  
  return {
    totalAnswers,
    averageConfidence: Math.round(avgConfidence * 10) / 10,
    averageTimePerQuestion: Math.round(avgTime),
    completedQuestions: [...new Set(answers.map(a => a.questionId))].length
  };
});

// Pre-save middleware to update session metadata
interviewSessionSchema.pre('save', function(next) {
  if (this.practiceAnswers.length > 0) {
    const categoryStats = this.practiceAnswers.reduce((acc, answer) => {
      const question = this.questions.find(q => q.id === answer.questionId);
      if (question) {
        if (!acc[question.category]) {
          acc[question.category] = { count: 0, totalConfidence: 0 };
        }
        acc[question.category].count++;
        acc[question.category].totalConfidence += answer.confidence;
      }
      return acc;
    }, {});

    // Update metadata
    this.sessionMetadata.questionsGenerated = this.questions.length;
    this.sessionMetadata.averageAnswerTime = Math.round(
      this.practiceAnswers.reduce((sum, answer) => sum + answer.timeSpent, 0) / this.practiceAnswers.length
    );

    // Find most and least practiced categories
    const sortedCategories = Object.entries(categoryStats)
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        avgConfidence: stats.totalConfidence / stats.count
      }))
      .sort((a, b) => b.count - a.count);

    if (sortedCategories.length > 0) {
      this.sessionMetadata.mostPracticedCategory = sortedCategories[0].category;
      this.sessionMetadata.weakestCategory = sortedCategories
        .sort((a, b) => a.avgConfidence - b.avgConfidence)[0].category;
    }

    // Update completion percentage
    const uniqueAnsweredQuestions = [...new Set(this.practiceAnswers.map(a => a.questionId))].length;
    this.completionPercentage = Math.round((uniqueAnsweredQuestions / this.questions.length) * 100);

    // Update overall confidence
    this.overallConfidence = Math.round(
      (this.practiceAnswers.reduce((sum, answer) => sum + answer.confidence, 0) / this.practiceAnswers.length) * 10
    ) / 10;

    // Update last practiced date
    this.lastPracticedAt = new Date();
  }

  next();
});

export const InterviewSession = model<IInterviewSession>('InterviewSession', interviewSessionSchema);