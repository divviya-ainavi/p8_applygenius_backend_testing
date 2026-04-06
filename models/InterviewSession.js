import { Schema, model, Document } from 'mongoose';

interface IQuestion extends Document {
  question: string;
  category: 'behavioral' | 'technical' | 'role-specific';
  difficulty: 'entry' | 'mid' | 'senior';
  suggestedAnswer?: string;
  starTemplate?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

interface IPracticeResponse extends Document {
  questionId: string;
  userAnswer: string;
  duration: number; // seconds spent answering
  confidence: number; // 1-5 rating
  feedback?: string;
  improvementSuggestions?: string[];
}

interface IInterviewSession extends Document {
  userId: string;
  jobId?: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  userProfile: {
    experience: any[];
    skills: string[];
    seniorityLevel: 'entry' | 'mid' | 'senior';
    roleType: string;
  };
  generatedQuestions: IQuestion[];
  practiceResponses: IPracticeResponse[];
  sessionStatus: 'created' | 'in-progress' | 'completed';
  totalDuration: number; // total practice time in seconds
  completionPercentage: number;
  overallScore: number; // calculated based on confidence ratings
  improvementAreas: string[];
  strengths: string[];
  lastPracticeDate: Date;
  practiceCount: number;
  settings: {
    questionCount: number;
    includeCategories: ('behavioral' | 'technical' | 'role-specific')[];
    difficultyLevel: 'entry' | 'mid' | 'senior';
    timeLimit?: number; // optional time limit per question
  };
}

const questionSchema = new Schema<IQuestion>({
  question: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['behavioral', 'technical', 'role-specific'], 
    required: true 
  },
  difficulty: { 
    type: String, 
    enum: ['entry', 'mid', 'senior'], 
    required: true 
  },
  suggestedAnswer: { type: String },
  starTemplate: {
    situation: { type: String },
    task: { type: String },
    action: { type: String },
    result: { type: String }
  }
}, { _id: true });

const practiceResponseSchema = new Schema<IPracticeResponse>({
  questionId: { type: String, required: true },
  userAnswer: { type: String, required: true },
  duration: { type: Number, required: true, min: 0 },
  confidence: { type: Number, required: true, min: 1, max: 5 },
  feedback: { type: String },
  improvementSuggestions: [{ type: String }]
}, { timestamps: true });

const interviewSessionSchema = new Schema<IInterviewSession>({
  userId: { type: String, required: true, index: true },
  jobId: { type: String, index: true },
  jobTitle: { type: String, required: true },
  company: { type: String, required: true },
  jobDescription: { type: String, required: true },
  userProfile: {
    experience: [{ type: Schema.Types.Mixed }],
    skills: [{ type: String }],
    seniorityLevel: { 
      type: String, 
      enum: ['entry', 'mid', 'senior'], 
      required: true 
    },
    roleType: { type: String, required: true }
  },
  generatedQuestions: [questionSchema],
  practiceResponses: [practiceResponseSchema],
  sessionStatus: { 
    type: String, 
    enum: ['created', 'in-progress', 'completed'], 
    default: 'created' 
  },
  totalDuration: { type: Number, default: 0, min: 0 },
  completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
  overallScore: { type: Number, default: 0, min: 0, max: 5 },
  improvementAreas: [{ type: String }],
  strengths: [{ type: String }],
  lastPracticeDate: { type: Date },
  practiceCount: { type: Number, default: 0, min: 0 },
  settings: {
    questionCount: { type: Number, default: 15, min: 5, max: 30 },
    includeCategories: [{
      type: String,
      enum: ['behavioral', 'technical', 'role-specific']
    }],
    difficultyLevel: { 
      type: String, 
      enum: ['entry', 'mid', 'senior'], 
      required: true 
    },
    timeLimit: { type: Number, min: 30 } // optional time limit in seconds
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
interviewSessionSchema.index({ userId: 1, createdAt: -1 });
interviewSessionSchema.index({ jobId: 1 });
interviewSessionSchema.index({ sessionStatus: 1 });

// Virtual for average confidence score
interviewSessionSchema.virtual('averageConfidence').get(function() {
  if (this.practiceResponses.length === 0) return 0;
  const total = this.practiceResponses.reduce((sum, response) => sum + response.confidence, 0);
  return total / this.practiceResponses.length;
});

// Virtual for questions answered
interviewSessionSchema.virtual('questionsAnswered').get(function() {
  return this.practiceResponses.length;
});

// Virtual for remaining questions
interviewSessionSchema.virtual('questionsRemaining').get(function() {
  return Math.max(0, this.generatedQuestions.length - this.practiceResponses.length);
});

// Method to update completion percentage
interviewSessionSchema.methods.updateProgress = function() {
  if (this.generatedQuestions.length === 0) {
    this.completionPercentage = 0;
    return;
  }
  
  this.completionPercentage = Math.round(
    (this.practiceResponses.length / this.generatedQuestions.length) * 100
  );
  
  if (this.completionPercentage === 100 && this.sessionStatus !== 'completed') {
    this.sessionStatus = 'completed';
  } else if (this.completionPercentage > 0 && this.sessionStatus === 'created') {
    this.sessionStatus = 'in-progress';
  }
};

// Method to calculate overall score
interviewSessionSchema.methods.calculateOverallScore = function() {
  if (this.practiceResponses.length === 0) {
    this.overallScore = 0;
    return;
  }
  
  const avgConfidence = this.averageConfidence;
  const completionBonus = this.completionPercentage / 100 * 0.5; // max 0.5 bonus
  this.overallScore = Math.min(5, avgConfidence + completionBonus);
};

// Pre-save middleware to update calculated fields
interviewSessionSchema.pre('save', function(next) {
  this.updateProgress();
  this.calculateOverallScore();
  
  if (this.practiceResponses.length > 0) {
    this.lastPracticeDate = new Date();
  }
  
  next();
});

export const InterviewSession = model<IInterviewSession>('InterviewSession', interviewSessionSchema);